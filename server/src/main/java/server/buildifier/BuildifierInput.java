package server.buildifier;

import java.nio.file.Path;

/**
 * A configuration used to execute the buildifier.
 */
class BuildifierInput {
    /**
     * The Bazel file content to process. This is passed to the buildifier through stdin.
     */
    private Path path;

    /**
     * Command line arguments to pass to buildifier. These will typicall be flags, e.g.
     * `--mode=fix`, `--lint=fix`, etc...
     */
    private String[] args;

    public Path getPath() {
        return path;
    }

    public void setPath(Path path) {
        this.path = path;
    }

    public String[] getArgs() {
        return args;
    }

    public void setArgs(String[] args) {
        this.args = args;
    }
}
