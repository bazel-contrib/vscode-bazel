package server.bazel;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.dispatcher.CommandDispatcher;

/**
 * A wrapper around the Bazel Server Commands. This allows callers to invoke Bazel Server commands
 */
public final class Bazel {
    private static final Logger logger = LogManager.getLogger(Bazel.class);
    private static final CommandDispatcher dispatcher = CommandDispatcher.create("bazel-command-dispatcher");

    /**
    * Creates an instance of a Bazel.
    */
    public Bazel() {
    }


}