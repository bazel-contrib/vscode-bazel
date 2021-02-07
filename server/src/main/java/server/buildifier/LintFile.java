package server.buildifier;

import java.util.List;

/**
 * File object that is created as a result of linting.
 */
public final class LintFile {
    /**
     * Name of file
     */
    private String filename;

    /**
     * Boolean indicating whether the file is properly formatted.
     */
    private boolean formatted;

    /**
     * Boolean indicating whether the file is valid.
     */
    private boolean valid;

    /**
     * List of LintWarning objects indicating any warnings.
     */
    private List<LintWarning> warnings;

    public String getFilename() {
        return filename;
    }

    public void setFilename(String filename) {
        this.filename = filename;
    }

    public boolean getFormatted() {
        return formatted;
    }

    public void setFormatted(boolean formatted) {
        this.formatted = formatted;
    }

    public boolean getValid() {
        return valid;
    }

    public void setValid(boolean valid) {
        this.valid = valid;
    }

    public List<LintWarning> getWarnings() {
        return warnings;
    }

    public void setWarnings(List<LintWarning> warnings) {
        this.warnings = warnings;
    }
}