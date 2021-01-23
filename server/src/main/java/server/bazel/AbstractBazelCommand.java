package server.bazel;

import java.io.PrintWriter;
import server.dispatcher.ICommand;

public abstract class AbstractBazelCommand implements ICommand {
    private String command;

    protected AbstractBazelCommand(String command) {
        this.command = String.format("pwd; bazel %s", command);
    }

    @Override
    public void dispatch(PrintWriter stdin) {
        stdin.println(command);
    }
}
