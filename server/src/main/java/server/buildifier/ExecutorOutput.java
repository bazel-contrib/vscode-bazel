package server.buildifier;

/**
 * A summary of the buildifier executable's output.
 */
class ExecutorOutput {
    /**
     * The raw output result. This is the result produced by buildifier's stdout.
     */
    private String rawOutput;

    /**
     * The raw error result. This is the result produced by buildifier's stderr.
     */
    private String rawError;

    /**
     * The exit code resulting from running the buildifier.
     */
    private int exitCode;

    public String getRawOutput() {
        return rawOutput;
    }

    public void setRawOutput(String rawOutput) {
        this.rawOutput = rawOutput;
    }

    public String getRawError() {
        return rawError;
    }

    public void setRawError(String rawError) {
        this.rawError = rawError;
    }

    public int getExitCode() {
        return exitCode;
    }

    public void setExitCode(int exitCode) {
        this.exitCode = exitCode;
    }
}
