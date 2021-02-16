package server.buildifier;

import java.io.PrintWriter;

import com.google.common.base.Preconditions;
import server.dispatcher.Executable;
import server.dispatcher.ICommand;

class BuildifierCommand implements ICommand {
    /**
     * The Bazel file content to process. This is passed to the buildifier through stdin.
     */
    private String content;

    /**
     * The buildifier executable. This will be the buildifier executable with ALL the necessary flags set.
     */
    private Executable executable;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public Executable getExecutable() {
        return executable;
    }

    public void setExecutable(Executable executable) {
        this.executable = executable;
    }

    @Override
    public void dispatch(PrintWriter stdin) {
        Preconditions.checkNotNull(getContent());
        stdin.println(getContent());
    }
}
