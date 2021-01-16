package server.buildifier;

import java.nio.file.Path;

/**
 * A configuration used to execute the buildifier.
 */
class RunnerInput {
    /**
     * The Bazel file content to process. This is passed to the buildifier through stdin.
     */
    private String content;

    /**
     * The path to the buildifier executable.
     */
    private Path executable;

    /**
     * Flags passed to the buildifier. Some examples of flags include "--mode=fix", "--lint=fix", etc...
     */
    private String[] flags;

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

    public String[] getFlags() {
        return flags;
    }

    public void setFlags(String[] flags) {
        this.flags = flags;
    }
}
