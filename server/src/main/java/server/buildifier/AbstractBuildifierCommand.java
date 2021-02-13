package server.buildifier;

import java.io.PrintWriter;

import server.dispatcher.ICommand;

class AbstractBuildifierCommand implements ICommand {
    private String command;

    public AbstractBuildifierCommand(String command) {
        this.command = String.format("buildifier %s", command);
    }

    @Override
    public void dispatch(PrintWriter stdin) {
        stdin.println(command);
    }
}
