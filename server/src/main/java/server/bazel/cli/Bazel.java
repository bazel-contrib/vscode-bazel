package server.bazel.cli;

import java.util.Optional;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.dispatcher.CommandDispatcher;
import server.dispatcher.CommandOutput;

/**
 * A wrapper around the Bazel Server Commands. This allows callers to invoke Bazel Server commands
 */
public final class Bazel {
    private static final Logger logger = LogManager.getLogger(Bazel.class);
    private static final CommandDispatcher dispatcher = CommandDispatcher.create("bazel-command-dispatcher");

    /**
    * Creates an instance of a Bazel.
    */
    private Bazel() {
    }

    public static void getBuildTargets() {
        try {
            Optional<CommandOutput> output = dispatcher.dispatch(new QueryCommand("...", "label"));
            if(output.isPresent()) {
                if(output.get().didError()) {
                    output.get().getErrorOutput().forEach(logger::info);
                } else {
                    output.get().getStandardOutput().forEach(logger::info);
                }
            }
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
    }
}