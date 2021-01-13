package server.buildifier;

import java.nio.file.Path;

/**
 * Arguments passed into the buildifier's file formatting tool.
 */
public final class FormatArgs {
    /**
     * The bazel file content to process.
     */
    private Path path;

    /**
     * Indicates which type of formatting should be appled to the file content.
     */
    private BuildifierFileType type;

    /**
     * Whether lint warnings with automatic fixes will be fixed as well.
     */
    private boolean shouldApplyLintFixes;

    public Path getPath() {
        return path;
    }

    public void setPath(Path path) {
        this.path = path;
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
