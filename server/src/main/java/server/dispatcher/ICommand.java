package server.dispatcher;

import java.io.PrintWriter;

public interface ICommand {
    void dispatch(PrintWriter stdin);
}
