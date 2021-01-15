package server.buildifier;

import java.nio.file.Path;

/**
 * A configuration used to execute the buildifier.
 */
class ExecutorInput {
    /**
     * The Bazel file content to process. This is passed to the buildifier through stdin.
     */
    private String content;

    /**
     * The path to the buildifier executable.
     */
    private Path executable;

    /**
     * Command line arguments to pass to buildifier. These will typicall be flags, e.g.
     * `--mode=fix`, `--lint=fix`, etc...
     */
    private String[] args;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Path getExecutable() {
        return executable;
    }

    public void setExecutable(Path executable) {
        this.executable = executable;
    }

    public String[] getArgs() {
        return args;
    }

    public void setArgs(String[] args) {
        this.args = args;
    }
}
