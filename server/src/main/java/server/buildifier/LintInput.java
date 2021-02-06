package server.buildifier;

import java.nio.file.Path;

/**
 * Arguments passed into the buildifier's linter.
 */
public final class LintInput {
    /**
     * The bazel file content to be processed.
     */
    private String content;

    /**
     * The type of file to be linted.
     */
    private BuildifierFileType type;

    /**
     * Boolean to indicate whether linter should apply fixes.
     */
    private boolean shouldApplyLintFixes;

    /**
     * Boolean to indicate whether linter should show warnings.
     */
    private boolean shouldApplyLintWarnings;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public BuildifierFileType getType() {
        return type;
    }

    public void setType(BuildifierFileType type) {
        this.type = type;
    }

    public boolean getShouldApplyLintFixes() {
        return shouldApplyLintFixes;
    }

    public void setShouldApplyLintFixes(boolean shouldApplyLintFixes) {
        this.shouldApplyLintFixes = shouldApplyLintFixes;
    }

    public boolean getShouldApplyLintWarnings() {
        return shouldApplyLintWarnings;
    }

    public void setShouldApplyLintWarnings(boolean shouldApplyLintWarnings) {
        this.shouldApplyLintWarnings = shouldApplyLintWarnings;
    }
}