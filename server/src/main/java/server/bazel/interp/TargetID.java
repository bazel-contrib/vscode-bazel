package server.bazel.interp;

import java.util.Objects;

public class TargetID extends LabelPart {
    private final boolean local;

    private TargetID(boolean local, String value) {
        super(value);
        this.local = local;
    }

    /**
     * Creates a TargetID from raw values.
     *
     * @param local A flag to indicate whether this target is local to a BUILD file. E.g. whether
     *              the ":" character prefixes the label.
     * @param value The value or name of the label.
     * @return A TargetID.
     */
    public static TargetID fromRaw(boolean local, String value) {
        return new TargetID(local, value);
    }

    /**
     * @return Whether this TargetID references a local package file target.
     */
    public boolean isLocal() {
        return local;
    }

    /**
     * @return Whether this TargetID references a source file present within a package.
     */
    public boolean isSourceFile() {
        return !isLocal();
    }

    @Override
    public String toString() {
        if (isSourceFile()) {
            return value();
        }

        return String.format(":%s", value());
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof TargetID)) return false;
        if (!super.equals(o)) return false;
        TargetID targetID = (TargetID) o;
        return local == targetID.local;
    }

    @Override
    public int hashCode() {
        return Objects.hash(super.hashCode(), local);
    }
}
