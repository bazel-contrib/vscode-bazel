package server.buildifier;

import java.nio.file.Path;

/**
 * Arguments passed into the buildifier's file formatting tool.
 */
public final class BuildifierFormatArgs {
    /**
     * The bazel file content to process.
     */
    private String content;

    /**
     * Indicates which type of formatting should be appled to the file content.
     */
    private BuildifierFileType type;

    /**
     * Whether lint warnings with automatic fixes will be fixed as well.
     */
    private boolean shouldApplyLintFixes;

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
}
