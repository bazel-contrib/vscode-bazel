package server.dispatcher;

import java.io.ByteArrayOutputStream;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.List;

/**
 * Represents the output of the command line. Contains the error output, standard output, and a flag if there was an error.
 */
public class CommandOutput {
    private List<String> standardOutput;
    private List<String> errorOutput;
    private String rawStandardOutput;
    private String rawErrorOutput;
    private int error;

    /**
     * @param standardOutput ByteArrayOutputStream that holds the standard output.
     * @param errorOutput ByteArrayOutputStream that holds the error output.
     * @param returnCode Return code from the command line
     * @throws UnsupportedEncodingException Thrown when 'standardOutput' or 'errorOutput' is not in UTF-8 format
     */
    public CommandOutput(ByteArrayOutputStream standardOutput, ByteArrayOutputStream errorOutput, int returnCode) throws UnsupportedEncodingException {
        this.rawStandardOutput = standardOutput.toString("UTF-8");
        this.rawErrorOutput = errorOutput.toString("UTF-8");
        this.standardOutput = Arrays.asList(rawStandardOutput.split("\n"));
        this.errorOutput = Arrays.asList(rawErrorOutput.split("\n"));
        this.error = returnCode;
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
     * Return the raw standard output of the command as a string
     * 
     * @return A String containing the standard output
     */
    public String getRawStandardOutput() {
        return rawStandardOutput;
    }

    /**
     * Returns the raw error output of the command as a string
     * 
     * @return A String containing the error output
     */
    public String getRawErrorOutput() {
        return rawErrorOutput;
    }

    /**
     * Returns whether the command line encountered an error when running a command.
     *
     * @return True if there was an error encountered.
     */
    public boolean didError() {
        return error != 0;
    }

    /**
     * Returns the error code in the form of an integer.
     * @return Integer representing error code
     */
    public int errorCode() {
        return error;
    }
}
