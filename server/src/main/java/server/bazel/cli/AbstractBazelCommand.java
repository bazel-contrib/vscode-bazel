package server.bazel.cli;

import java.io.PrintWriter;

import server.dispatcher.Executable;
import server.dispatcher.ICommand;

public abstract class AbstractBazelCommand implements ICommand {
    private String command;

    protected AbstractBazelCommand(String command) {
        this.command = String.format("bazel %s", command);
    }

    @Override
    public void dispatch(PrintWriter stdin) {
        stdin.println(command);
    }

    @Override
    public Executable getExecutable() {
        return Executable.fromShell();
    }
}
