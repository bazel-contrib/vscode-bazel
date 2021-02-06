package server.buildifier;

/**
 * Results of the buildifier format method.
 */
public final class FormatOutput {
    /**
     * The String of the result.
     */
    private String result;

    public FormatOutput(String result) {
        this.result = result;
    }

    public String getResult() {
        return result;
    }

    public void setResult(String result) {
        this.result = result;
    }
}