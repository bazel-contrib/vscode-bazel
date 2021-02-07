package server.buildifier;

import java.nio.file.Path;
import java.util.List;

/**
 * Object that is created from buildifier lint results
 */
public final class LintOutput {
    /**
     * Boolean indicating whether the linting was a success.
     */
    private boolean success;

    /**
     * List of files that were linted.
     */
    private List<LintFile> files;

    public boolean getSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public List<LintFile> getFiles() {
        return files;
    }

    public void setFiles(List<LintFile> files) {
        this.files = files;
    }
}