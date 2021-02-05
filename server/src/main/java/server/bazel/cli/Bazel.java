package server.bazel.cli;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.bazel.tree.BuildTarget;
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

    public static List<BuildTarget> getBuildTargets() throws BazelServerException{
        logger.info("Getting BuildTargets...");
        try {
            Optional<CommandOutput> output = dispatcher.dispatch(new QueryCommand("...", "label_kind"));
            if(output.isPresent()) {
                if(output.get().didError()) {
                    throw new BazelServerException(parseError(output.get().getErrorOutput()));
                } else {
                    return parseBuildTargets(output.get().getStandardOutput());
                }
            }
        } catch (InterruptedException e) {
            e.printStackTrace();
        }
        return new ArrayList<>();
    }

    private static String parseError(List<String> errorOutput) {
        logger.info("Parsing Error");
        for(String line : errorOutput) {
            if(line.startsWith("ERROR")) {
                return line;
            }
        }
        return "Unknown Bazel Error";
    }

    private static List<BuildTarget> parseBuildTargets(List<String> standardOutput) {
        logger.info("Parsing Build Targets");
        List<BuildTarget> buildTargets = new ArrayList<>();
        standardOutput.stream().forEach(line -> {
            logger.info(line);
            List<String> parts = Arrays.asList(line.split("\\s+"));
            List<String> ruleSplit = parsePath(parts.get(2));
            buildTargets.add(new BuildTarget(Path.of(ruleSplit.get(0).substring(1)),ruleSplit.get(1), parts.get(0)));
        });
        return buildTargets;
    }

    private static List<String> parsePath(String s) {
        return Arrays.asList(s.split(":"));
    }
}