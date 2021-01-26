package server.bazel;

public class VersionCommand extends AbstractBazelCommand {
    protected VersionCommand() {
        super(String.format("--version"));
    }
}