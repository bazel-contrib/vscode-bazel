package server.dispatcher;

import java.io.PrintWriter;

/**
 * Interface for all commands to be dispatched to the command line through a CommandDispatcher
 */
public interface ICommand {
    /**
     * Method that will write to the command line. It is recommended to let a CommandDispatcher call this method.
     *
     * @param stdin Writer to command line.
     */
    void dispatch(PrintWriter stdin);
}
