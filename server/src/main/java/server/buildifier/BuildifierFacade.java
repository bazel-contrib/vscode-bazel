package server.buildifier;

import com.google.common.base.Charsets;
import com.google.common.base.Preconditions;
import com.google.common.io.CharStreams;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.utils.Environment;
import server.workspace.ExtensionConfig;
import server.workspace.Workspace;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Stream;

/**
 * A wrapper around the buildifier CLI. This allows callers to invoke buildifier commands which
 * format documents, check linting, etc.
 */
public final class BuildifierFacade {
    private static final String DEFAULT_BUILDIFIER_NAME = "buildifier";
    private static final Logger logger = LogManager.getLogger(BuildifierFacade.class);

    private BuildifierFacade() {

    }

    /**
     * Locates the buildifier executable to check if it exists.
     *
     * @return Whether the buildifier exists.
     */
    public static boolean buildifierExists() {
        try {
            locateBuildifier();
            return true;
        } catch (BuildifierNotFoundException e) {
            return false;
        }
    }

    /**
     * Invokes the buildifier in format mode.
     *
     * @param args The arguments to run the buildifier with.
     * @throws BuildifierException If the buildifier fails to execute.
     */
    public static void format(final FormatArgs args) throws BuildifierException {
        Preconditions.checkNotNull(args);
        Preconditions.checkNotNull(args.getPath());
        Preconditions.checkNotNull(args.getType());

        final BuildifierInput input = new BuildifierInput();

        // Build the command line args.
        final List<String> cliargs = new ArrayList<>();
        {
            cliargs.add("--mode=fix");
            cliargs.add(String.format("--type=%s", args.getType().toCLI()));

            if (args.getShouldApplyLintFixes()) {
                cliargs.add("--lint=fix");
            }
        }

        logger.info(String.format("Formatting file content at \"%s\".", args.getPath().toAbsolutePath()));

        // Run the buildifier.
        input.setPath(args.getPath());
        input.setArgs(cliargs.toArray(new String[0]));
        final BuildifierOutput output = execute(input);

        logger.info("OUTPUT: " + output.getRawOutput());
        logger.info("ERROR: " + output.getRawError());
        logger.info("EXIT CODE: " + output.getExitCode());
    }

    /**
     * Executes the buildifier. This method will produce output even if the buildifier executes and runs
     * into an error during execution. Exceptions are only thrown if the buildifier can't be run.
     *
     * @param input Specifies how to run the buildifier.
     * @return A representation of the buildifier executable's output. This includes stdout and stderr.
     * @throws BuildifierException If the buildifier failed to execute.
     */
    private static BuildifierOutput execute(BuildifierInput input) throws BuildifierException {
        Preconditions.checkNotNull(input);
        Preconditions.checkNotNull(input.getArgs());
        Preconditions.checkNotNull(input.getPath());

        // Get the effective paths for the buildifier.
        final String buildifierPath = locateBuildifier().toAbsolutePath().toString();

        // Package the command line arguments.
        final String[] cmdarr = Stream.concat(
                Arrays.stream(new String[]{buildifierPath}),
                Arrays.stream(input.getArgs()))
                .toArray(String[]::new);

        // Execute the buildifier.
        try {
            logger.info(String.format("Executing buildifier at \"%s\".", buildifierPath));

            final Runtime runtime = Runtime.getRuntime();
            final Process process = runtime.exec(cmdarr);

            final InputStream inputStream = process.getInputStream();
            final OutputStream outputStream = process.getOutputStream();
            final InputStream errorStream = process.getErrorStream();

            // Write the file contents to buildifier using its stdin.
            {
                final byte[] contents = Files.readAllBytes(input.getPath());
                outputStream.write(contents);
                outputStream.close();
            }

            final BuildifierOutput output = new BuildifierOutput();

            // Package stdout output.
            {
                final Readable readable = new InputStreamReader(inputStream, Charsets.UTF_8);
                output.setRawOutput(CharStreams.toString(readable));
                inputStream.close();
            }

            // Package stderr output.
            {
                final Readable readable = new InputStreamReader(errorStream, Charsets.UTF_8);
                output.setRawError(CharStreams.toString(readable));
                errorStream.close();
            }

            // Package the exit code once it finishes executing.
            // TODO: We should probably use a completable future here so we don't hang.
            {
                output.setExitCode(process.waitFor());
            }

            logger.info(String.format("Finished executing buildifier.\n" +
                    "Recieved output: \"%s\"\n" +
                    "Recieved error: \"%s\"", output.getRawOutput(), output.getRawError()));

            return output;
        } catch (IOException e) {
            logger.error("Buildifier was located but failed to execute!", e);
            throw new BuildifierException();
        } catch (Exception e) {
            logger.error("An unknown error occured!", e);
            throw new BuildifierException();
        }
    }

    /**
     * Locates the path to the buildifier binary. The buildifier specified on the extension
     * configuration will be favored first. If that doesn't exist, this method will search
     * the system path for the buildifier. The returned path is guaranteed to be executable.
     *
     * @return The path to the buildifier binary.
     * @throws BuildifierNotFoundException If the buildifer couldn't be found.
     */
    private static Path locateBuildifier() throws BuildifierNotFoundException {
        Preconditions.checkNotNull(Workspace.getInstance());
        Preconditions.checkNotNull(Workspace.getInstance().getExtensionConfig());

        final ExtensionConfig config = Workspace.getInstance().getExtensionConfig();
        logger.info("Locating buildifier.");

        // The extension config path will take priority over the inferred paths. Try
        // to load the buildifier from the extension configuration.
        {
            final Path path = Paths.get(config.getBazel().getBuildifier().getExecutable());
            if (Files.exists(path, LinkOption.NOFOLLOW_LINKS) && path.toFile().canExecute()) {
                logger.info("Buildifer was located from the configuration settings.");
                return path;
            }
        }

        // Try to find the buildifier in the system PATH.
        {
            final Path path = Environment.searchPath(DEFAULT_BUILDIFIER_NAME);
            if (path != null && Files.exists(path, LinkOption.NOFOLLOW_LINKS) && path.toFile().canExecute()) {
                logger.info("Buildifier was located from the system PATH.");
                return path;
            }
        }

        logger.info("Buildifier not found.");
        throw new BuildifierNotFoundException();
    }
}
