package server.bazel;

public class QueryCommand extends AbstractBazelCommand {
    protected QueryCommand(String target, String option) {
        super(String.format("query %s --options %s", target, option));
    }
}
