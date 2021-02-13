package server.buildifier;

import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import server.dispatcher.CommandDispatcher;
import server.dispatcher.CommandOutput;
import server.utils.FileRepository;
import server.utils.Nullability;
import server.workspace.Workspace;

import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import com.google.gson.Gson;

/**
 * A wrapper around the buildifier CLI. This allows callers to invoke buildifier commands which
 * format documents, check linting, etc.
 */
public final class Buildifier {
    private static final Logger logger = LogManager.getLogger(Buildifier.class);
    private static final CommandDispatcher dispatcher = CommandDispatcher.create("buildifier-command-dispatcher");

    private FileRepository fileRepository;

    /**
     * Creates an instance of a buildifier.
     */
    public Buildifier() {
        fileRepository = null;
    }

    /**
     * Checks to see if the buildififer executable exists.
     *
     * @return Whether the buildififer executable exists.
     */
    public boolean exists() {
        try {
            locateExecutable();
            return true;
        } catch (BuildifierNotFoundException e) {
            return false;
        }
    }

    /**
     * Invokes the buildifier in format mode.
     *
     * @param args The arguments to run the buildifier with.
     * @return The formatted content.
     * @throws BuildifierException If the buildifier fails to execute.
     */
    public FormatOutput format(final FormatInput args) throws BuildifierException {
        Preconditions.checkNotNull(args);
        Preconditions.checkNotNull(args.getContent());
        Preconditions.checkNotNull(args.getType());

        final RunnerInput input = new RunnerInput();

        // Build the command line args.
        final List<String> cmdArgs = new ArrayList<>();
        {
            cmdArgs.add("--mode=fix");
            cmdArgs.add(String.format("--type=%s", args.getType().toCLI()));

            if (args.getShouldApplyLintFixes()) {
                cmdArgs.add("--lint=fix");
            }
        }

        logger.info(String.format("Formatting content \"%s\".", args.getContent()));

        // Run the buildifier.
        input.setContent(args.getContent());
        input.setFlags(cmdArgs.toArray(new String[0]));
        input.setExecutable(locateExecutable());
        final RunnerOutput output = getEffectiveRunner().run(input);

        // Return the successfully formated contents if the exit code indicated a valid
        // format result.
        if (output.getExitCode() == 0) {
            logger.info(String.format(
                    "Successfully formatted content: \"%s\"",
                    output.getRawOutput()));
            return new FormatOutput(output.getRawOutput());
        }

        // TODO: Handle errors more appropriately with more information.
        logger.warn(String.format(
                "Failed to format with exit code %d. Error output is \"%s\"",
                output.getExitCode(),
                output.getRawError()));

        throw new BuildifierException();
    }

    /**
     * Calls the buildifier linter to check for warnings and provide fixes.
     * @param lintInput A LintInput object that contains the details of how the file should be linted.
     * @return LintOutput object.
     * @throws BuildifierException If the buildifier fails to execute
     */
    public LintOutput lint(LintInput lintInput) throws BuildifierException {
        Preconditions.checkNotNull(lintInput);
        Preconditions.checkNotNull(lintInput.getContent());
        Preconditions.checkNotNull(lintInput.getType());

        //final RunnerInput input = new RunnerInput();

        //Set up command line arguments
        final List<String> cmdArgs = new ArrayList<>();
        {
            cmdArgs.add(String.format("--type=%s", lintInput.getType().toCLI()));
            cmdArgs.add("--format=json");

            if(lintInput.getShouldApplyLintWarnings()) {
                cmdArgs.add("--mode=check");
                cmdArgs.add("--lint=warn");
            }

            if(lintInput.getShouldApplyLintFixes()) {
                cmdArgs.add("--mode=fix");
                cmdArgs.add("--lint=fix");
            }
        }

        logger.info(String.format("Linting content \"%s\".", lintInput.getContent()));

        // Run buildifier
        //input.setContent(lintInput.getContent());
        //input.setFlags(cmdArgs.toArray(new String[0]));
        //input.setExecutable(locateExecutable());
        //final RunnerOutput output = getEffectiveRunner().run(input);

        String input = convertListToCommandString(cmdArgs);

        CommandDispatcher dispatcher = CommandDispatcher.create("buildifier-command-dispatcher");
        try {
            Optional<CommandOutput> output = dispatcher.dispatch(new AbstractBuildifierCommand(input));
        
            // Return the linted contents if returned with a valid exit code.
            if(!output.isPresent()) {
                logger.warn("No output was returned from buildifier lint command");
                throw new BuildifierException();
            }
            if(!output.get().didError()) {
                logger.info(String.format("Successfully linted content: \"%s\"",
                        output.get().getRawStandardOutput()));
                Gson gson = new Gson();
                LintOutput lintOutput = gson.fromJson(output.get().getRawStandardOutput(), LintOutput.class);
                return lintOutput;
            }

            logger.warn(String.format("Failed to lint with exit code %d. Error output is \"%s\"",
            output.get().errorCode(),
            output.get().getRawErrorOutput()));
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        
        throw new BuildifierException();
    }

    /**
     * Locates the path to the buildifier binary. The buildifier specified on the extension
     * configuration will be favored first. If that doesn't exist, this method will search
     * the system path for the buildifier. The returned path is guaranteed to be executable.
     *
     * @return The path to the buildifier binary.
     * @throws BuildifierNotFoundException If the buildifer couldn't be found.
     */
    private Path locateExecutable() throws BuildifierNotFoundException {
        logger.info("Locating buildifier.");

        // The extension config path will take priority over the inferred paths. Try
        // to load the buildifier from the extension configuration.
        {
            String executablePathStr = Nullability.access(() -> Workspace.getInstance().getExtensionConfig().
                    getBazel().getBuildifier().getExecutable());
            executablePathStr = executablePathStr == null ? "" : executablePathStr;

            final Path executablePath = fileRepository.getFileSystem().getPath(executablePathStr);
            if (!executablePathStr.isEmpty() &&
                    Files.exists(executablePath, LinkOption.NOFOLLOW_LINKS) &&
                    fileRepository.isExecutable(executablePath)
            ) {
                logger.info("Buildifer was located from the configuration settings.");
                return executablePath;
            }
        }

        // Try to find the buildifier in the system PATH.
        {
            final String buildifierName = getStandardExecutableName();
            final Path path = getEffectiveFileRepository().searchPATH(buildifierName);
            if (path != null &&
                    Files.exists(path, LinkOption.NOFOLLOW_LINKS) &&
                    fileRepository.isExecutable(path)
            ) {
                logger.info("Buildifier was located from the system PATH.");
                return path;
            }
        }

        logger.info("Buildifier not found.");
        throw new BuildifierNotFoundException();
    }

    /**
     * The standard buildifier executable name. This will match the name of the executable as found
     * on the buildifier releases page.
     *
     * @see <a href="https://github.com/bazelbuild/buildtools/releases">Buildifier releases</a>
     */
    static String getStandardExecutableName() {
        // TODO: Return different values based on linux, mac, windows.
        return "buildifier";
    }

    /**
     * Gets the effective file repository used for accessing files.
     *
     * @return The effective file repository.
     */
    private FileRepository getEffectiveFileRepository() {
        return getFileRepository() == null ? FileRepository.getDefault() : getFileRepository();
    }

    /**
     * Gets the effective runner used for running a buildifier.
     *
     * @return The effective runner.
     */
    private Runner getEffectiveRunner() {
        return getRunner() == null ? FALLBACK_RUNNER : getRunner();
    }

    FileRepository getFileRepository() {
        return fileRepository;
    }

    void setFileRepository(FileRepository fileRepository) {
        this.fileRepository = fileRepository;
    }

    Runner getRunner() {
        return runner;
    }

    void setRunner(Runner runner) {
        this.runner = runner;
    }

    private String convertListToCommandString(List<String> list) {
        StringBuilder output = new StringBuilder();
        for(String s : list) {
            output.append(String.format(" %s", s));
        }
        return output.toString();
    }
}
