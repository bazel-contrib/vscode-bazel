package server.buildifier;

import com.google.common.base.Charsets;
import com.google.common.base.Preconditions;
import com.google.common.io.CharStreams;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.Arrays;
import java.util.stream.Stream;

/**
 * The fallback buildifier runner. This runner will run a buildifier executable at a
 * provided location. The input and output will be sent to and retrived from the buildifier
 * through stdin and stdout respectively.
 */
class FallbackRunner implements Runner {
    private static final Logger logger = LogManager.getLogger(FallbackRunner.class);

    @Override
    public RunnerOutput run(RunnerInput input) throws BuildifierException {
        Preconditions.checkNotNull(input);
        Preconditions.checkNotNull(input.getFlags());
        Preconditions.checkNotNull(input.getContent());
        Preconditions.checkNotNull(input.getExecutable());

        // Get the effective paths for the buildifier.
        final String buildifierPath = input.getExecutable().toAbsolutePath().toString();

        // Package the command line arguments.
        final String[] cmdArgs = Stream.concat(
                Arrays.stream(new String[]{buildifierPath}),
                Arrays.stream(input.getFlags()))
                .toArray(String[]::new);

        // Execute the buildifier.
        try {
            logger.info(String.format("Executing buildifier at \"%s\".", buildifierPath));

            final Runtime runtime = Runtime.getRuntime();
            final Process process = runtime.exec(cmdArgs);

            final InputStream inputStream = process.getInputStream();
            final OutputStream outputStream = process.getOutputStream();
            final InputStream errorStream = process.getErrorStream();

            // Write the contents to buildifier using its stdin.
            {
                final byte[] content = input.getContent().getBytes();
                outputStream.write(content);
                outputStream.close();

                logger.info(String.format("Wrote content into the buildifier: \"%s\".", input.getContent()));
            }

            final RunnerOutput output = new RunnerOutput();

            // Package stdout output.
            {
                final Readable readable = new InputStreamReader(inputStream, Charsets.UTF_8);
                output.setRawOutput(CharStreams.toString(readable));
                inputStream.close();

                logger.info(String.format("Read raw output from buildifier: \"%s\".", output.getRawOutput()));
            }

            // Package stderr output.
            {
                final Readable readable = new InputStreamReader(errorStream, Charsets.UTF_8);
                output.setRawError(CharStreams.toString(readable));
                errorStream.close();

                logger.info(String.format("Read raw error from buildifier: \"%s\".", output.getRawError()));
            }

            // Package the exit code once it finishes executing.
            // TODO: We should probably use a completable future here so we don't hang.
            {
                output.setExitCode(process.waitFor());
                logger.info(String.format("Buildifier finished with exit code \"%d\".", output.getExitCode()));
            }

            return output;
        } catch (IOException e) {
            logger.error("Buildifier was located but failed to execute!", e);
            throw new BuildifierException();
        } catch (Exception e) {
            logger.error("An unknown error occured!", e);
            throw new BuildifierException();
        }
    }
}
