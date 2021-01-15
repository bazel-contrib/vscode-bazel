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
 * The fallback buildifier executable.
 */
class ExecutorFallback implements Executor {
    private static final Logger logger = LogManager.getLogger(ExecutorFallback.class);

    @Override
    public ExecutorOutput run(ExecutorInput input) throws BuildifierException {
        Preconditions.checkNotNull(input);
        Preconditions.checkNotNull(input.getArgs());
        Preconditions.checkNotNull(input.getContent());
        Preconditions.checkNotNull(input.getExecutable());

        // Get the effective paths for the buildifier.
        final String buildifierPath = input.getExecutable().toAbsolutePath().toString();

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

            // Write the contents to buildifier using its stdin.
            {
                final byte[] content = input.getContent().getBytes();
                outputStream.write(content);
                outputStream.close();
            }

            final ExecutorOutput output = new ExecutorOutput();

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
}
