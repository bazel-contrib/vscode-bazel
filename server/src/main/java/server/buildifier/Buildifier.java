package server.buildifier;

import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import server.dispatcher.CommandDispatcher;
import server.dispatcher.CommandOutput;
import server.dispatcher.Executable;
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
    private static final CommandDispatcher fallbackDispatcher = CommandDispatcher.create("buildifier");

    private FileRepository fileRepository;
    private CommandDispatcher dispatcher;

    /**
     * Creates an instance of a buildifier.
     */
    public Buildifier() {
        fileRepository = null;
        dispatcher = null;
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
     * @param input The arguments to run the buildifier with.
     * @return The formatted content.
     * @throws BuildifierException If the buildifier fails to execute.
     */
    public FormatOutput format(final FormatInput input) throws BuildifierException {
        Preconditions.checkNotNull(input);
        Preconditions.checkNotNull(input.getContent());
        Preconditions.checkNotNull(input.getType());

        // Build the command line args.
        String[] cmdArgs;
        {
            final List<String> cmdArgsList = new ArrayList<>();

            cmdArgsList.add(locateInvokableExecutable());
            cmdArgsList.add("--mode=fix");
            cmdArgsList.add(String.format("--type=%s", input.getType().toCLI()));

            if (input.getShouldApplyLintFixes()) {
                cmdArgsList.add("--lint=fix");
            }

            cmdArgs = cmdArgsList.toArray(new String[0]);
        }

        logger.info(String.format("Formatting content \"%s\".", input.getContent()));

        // Run the buildifier.
        final BuildifierCommand command = new BuildifierCommand();
        command.setContent(input.getContent());
        command.setExecutable(Executable.fromCmds(cmdArgs));
        final CommandOutput output = runCommand(command);

        // Return the successfully formated contents if the exit code indicated a valid format result.
        if (output.getReturnCode() == 0) {
            logger.info(String.format("Successfully formatted content: \"%s\"", output.getRawStandardOutput()));
            return new FormatOutput(output.getRawStandardOutput());
        }

        // TODO: Handle errors more appropriately with more information.
        logger.warn(String.format(
                "Failed to format with exit code %d. Error output is \"%s\"",
                output.getReturnCode(),
                output.getRawErrorOutput()));

        throw new BuildifierException();
    }

    /**
     * Calls the buildifier linter to check for warnings and provide fixes.
     *
     * @param input A LintInput object that contains the details of how the file should be linted.
     * @return LintOutput object.
     * @throws BuildifierException If the buildifier fails to execute
     */
    public LintOutput lint(LintInput input) throws BuildifierException {
        Preconditions.checkNotNull(input);
        Preconditions.checkNotNull(input.getContent());
        Preconditions.checkNotNull(input.getType());

        // Set up command line arguments
        String[] cmdArgs;
        {
            final List<String> cmdArgsList = new ArrayList<>();

            cmdArgsList.add(locateInvokableExecutable());

            cmdArgsList.add(String.format("--type=%s", input.getType().toCLI()));
            cmdArgsList.add("--format=json");

            if (input.getShouldApplyLintWarnings()) {
                cmdArgsList.add("--mode=check");
                cmdArgsList.add("--lint=warn");
            }

            if (input.getShouldApplyLintFixes()) {
                cmdArgsList.add("--mode=fix");
                cmdArgsList.add("--lint=fix");
            }

            cmdArgs = cmdArgsList.toArray(new String[0]);
        }

        logger.info(String.format("Linting content \"%s\".", input.getContent()));

        // Run buildifier
        final BuildifierCommand command = new BuildifierCommand();
        command.setContent(input.getContent());
        command.setExecutable(Executable.fromCmds(cmdArgs));
        final CommandOutput output = runCommand(command);

        if (output.didSucceed()) {
            logger.info(String.format("Successfully linted content: \"%s\"", output.getRawStandardOutput()));
            return new Gson().fromJson(output.getRawStandardOutput(), LintOutput.class);
        }

        logger.warn(String.format("Failed to lint with exit code %d. Error output is \"%s\"",
                output.getReturnCode(), output.getRawErrorOutput()));
        throw new BuildifierException();
    }

    /**
     * Gets a string representation of an invokable buildifier binary.
     *
     * @return The invokable buildifier binary.
     * @throws BuildifierNotFoundException If the buildifier couldn't be found.
     */
    private String locateInvokableExecutable() throws BuildifierNotFoundException {
        return locateExecutable().toAbsolutePath().toString();
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
            String executablePathStr = Nullability.nullable(() -> Workspace.getInstance().getExtensionConfig().
                    getBazel().getBuildifier().getExecutable());
            executablePathStr = executablePathStr == null ? "" : executablePathStr;

            final Path executablePath = getEffectiveFileRepository().getFileSystem().getPath(executablePathStr);
            if (!executablePathStr.isEmpty() &&
                    Files.exists(executablePath, LinkOption.NOFOLLOW_LINKS) &&
                    getEffectiveFileRepository().isExecutable(executablePath)
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
                    getEffectiveFileRepository().isExecutable(path)
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

    private FileRepository getEffectiveFileRepository() {
        return getFileRepository() == null ? FileRepository.getDefault() : getFileRepository();
    }

    private CommandDispatcher getEffectiveDispatcher() {
        return dispatcher != null ? dispatcher : fallbackDispatcher;
    }

    private CommandOutput runCommand(BuildifierCommand cmd) throws BuildifierException {
        try {
            Optional<CommandOutput> output = getEffectiveDispatcher().dispatch(cmd);

            if (!output.isPresent()) {
                logger.warn("No output was returned from buildifier.");
                throw new BuildifierException();
            }

            return output.get();
        } catch (InterruptedException e) {
            logger.error(e);
            throw new BuildifierException();
        }
    }

    FileRepository getFileRepository() {
        return fileRepository;
    }

    void setFileRepository(FileRepository fileRepository) {
        this.fileRepository = fileRepository;
    }

    CommandDispatcher getDispatcher() {
        return dispatcher;
    }

    void setDispatcher(CommandDispatcher dispatcher) {
        this.dispatcher = dispatcher;
    }
}
