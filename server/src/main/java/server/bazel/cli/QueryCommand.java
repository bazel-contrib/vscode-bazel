package server.bazel.cli;

public class QueryCommand extends AbstractBazelCommand {
    protected QueryCommand(String target, String option) {
        super(String.format("query %s --output %s", target, option));
    }

    protected QueryCommand(String target) {
        this(target, "label_kind");
    }
}
