package server.bazel.interp;

public class WorkspaceID extends LabelPart {
    private WorkspaceID(String value) {
        super(value);
    }

    /**
     * Creates a WorkspaceID from raw values.
     *
     * @param value The value or name of the workspace. E.g. `rules_java`.
     * @return A WorkspaceID.
     */
    public static WorkspaceID fromRaw(String value) {
        return new WorkspaceID(value);
    }

    @Override
    public String toString() {
        return String.format("@%s", value());
    }
}
