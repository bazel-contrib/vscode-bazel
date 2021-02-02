package server.dispatcher;

import java.io.ByteArrayOutputStream;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.List;

/**
 * Represents the output of the command line. Contains the error output, standard output, and a flag if there was an error.
 */
public class CommandOutput {
    private boolean error;
    private List<String> errorOutput;
    private List<String> standardOutput;

    /**
     * @param standardOutput ByteArrayOutputStream that holds the standard output.
     * @param errorOutput ByteArrayOutputStream that holds the error output.
     * @param returnCode Return code from the command line
     * @throws UnsupportedEncodingException Thrown when 'standardOutput' or 'errorOutput' is not in UTF-8 format
     */
    public CommandOutput(ByteArrayOutputStream standardOutput, ByteArrayOutputStream errorOutput, int returnCode) throws UnsupportedEncodingException {
        this.standardOutput = Arrays.asList(standardOutput.toString("UTF-8").split("\n"));
        this.errorOutput = Arrays.asList(errorOutput.toString("UTF-8").split("\n"));
        this.error = returnCode != 0;
    }

    /**
     * Returns a list of strings that are the individual lines of the error output.
     *
     * @return A list of strings.
     */
    public List<String> getErrorOutput() {
        return errorOutput;
    }

    /**
     * Returns a list of strings that are the individual lines of the standard output.
     *
     * @return A list of strings
     */
    public List<String> getStandardOutput() {
        return standardOutput;
    }

    /**
     * Returns whether the command line encountered an error when running a command.
     *
     * @return True if there was an error encountered.
     */
    public boolean didError() {
        return error;
    }
}
