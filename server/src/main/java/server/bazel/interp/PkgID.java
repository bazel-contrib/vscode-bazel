package server.bazel.interp;

public class PkgID extends LabelPart {
    private PkgID(String value) {
        super(value);
    }

    /**
     * Creates a PkgID from raw values.
     *
     * @param value The value or name of the package. E.g. `path/to/etc`.
     * @return A PkgID.
     */
    public static PkgID fromRaw(String value) {
        return new PkgID(value);
    }

    @Override
    public String toString() {
        return String.format("//%s", value());
    }
}
