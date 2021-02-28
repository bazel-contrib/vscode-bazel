package server.bazel.interp;

public class LabelSyntaxException extends InterpException {
    public LabelSyntaxException() {
        super();
    }

    public LabelSyntaxException(String msg) {
        super(msg);
    }
}
