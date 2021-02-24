package server.utils;

import java.io.PrintWriter;
import java.io.StringWriter;

/**
 * Utils for logging.
 */
public final class Logging {
    private Logging() {

    }

    /**
     * Converts the stack trace of an error to a string.
     *
     * @param e The error to use.
     * @return The stack trace formatted as a string.
     */
    public static String stackTraceToString(Exception e) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        e.printStackTrace(pw);
        return sw.toString();
    }
}
