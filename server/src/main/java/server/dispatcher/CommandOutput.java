package server.dispatcher;

import java.io.ByteArrayOutputStream;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.List;

public class CommandOutput {
    private boolean error;
    private List<String> errorOutput;
    private List<String> standardOutput;

    public CommandOutput(ByteArrayOutputStream standardOutput, ByteArrayOutputStream errorOutput, int returnCode) throws UnsupportedEncodingException {
        this.standardOutput = Arrays.asList(standardOutput.toString("UTF-8").split("\n"));
        this.errorOutput = Arrays.asList(errorOutput.toString("UTF-8").split("\n"));
        this.error = returnCode != 0;
    }

    public List<String> getErrorOutput() {
        return errorOutput;
    }

    public List<String> getStandardOutput() {
        return standardOutput;
    }

    public boolean didError() {
        return error;
    }
}
