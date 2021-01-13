package server.buildifier;

/**
 * Represents which the type of a Bazel file. This is used to determine how to
 * lint and format the file. These are specifc to the buildifer.
 */
public enum BuildifierFileType {
    BUILD,
    BZL,
    WORKSAPCE;

    /**
     * Converts the current value to a recognizable buildifier CLI file type.
     * @return The buildifier file type in CLI form.
     */
    String toCLI() {
        switch (this) {
            case BUILD:
                return "build";
            case BZL:
                return "bzl";
            case WORKSAPCE:
                return "workspace";
        }

        throw new UnsupportedOperationException();
    }
}
