package server.buildifier;

public final class LintWarning {

    /**
     * Position of where the warning starts.
     */
    private LintWarningPosition start;

    /**
     * Position of where the warning ends.
     */
    private LintWarningPosition end;

    /**
     * Category of the warning.
     */
    private String category;

    /**
     * Indicates whether the warning is actionable.
     */
    private boolean actionable;

    /**
     * Message describing the warning.
     */
    private String message;

    /**
     * Link to the category description in the buildifier repo.
     */
    private String url;

    public LintWarningPosition getStart() {
        return start;
    }

    public void setStart(LintWarningPosition start) {
        this.start = start;
    }

    public LintWarningPosition getEnd() {
        return end;
    }

    public void setEnd(LintWarningPosition end) {
        this.end = end;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public boolean getActionable() {
        return actionable;
    }

    public void setActionable(boolean actionable) {
        this.actionable = actionable;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}