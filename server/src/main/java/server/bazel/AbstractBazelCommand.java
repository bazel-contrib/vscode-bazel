package server.bazel;

import java.io.PrintWriter;
import server.dispatcher.ICommand;

public abstract class AbstractBazelCommand implements ICommand {
    private String command = "bazel ";

    public AbstractBazelCommand(String command) {
        this.command += command;
    }

    @Override
    public void dispatch(PrintWriter stdin) {
        stdin.println(command);
    }
}
