package server.bazel.interp;

/**
 * Represents a Bazel target label. E.g. `@maven//some/other:package_name`.
 */
public class Label {
    /**
     * The name of the label. This will be the name provided on the declaring rule.
     * For example, if a project depended on a rule from a Maven workspace
     * `@maven//some/other:package_name`, then this parameter would be equal to
     * `package_name`.
     */
    final String name;

    /**
     * The path relative to the workspace file. For example, if a project depended
     * on a rule from a Maven workspace `@maven//some/other:package`, then this
     * parameter would be equal to `some/other`.
     */
    final String path;

    /**
     * The workspace that this label resides in. For example, if a project depended
     * on a rule from a Maven workspace `@maven//some/other:package`, then this
     * parameter would be equal to `maven`.
     * <p>
     * If empty, this rule is a part of the current workspace.
     */
    final String workspace;

    private Label(String name, String workspace, String path) {
        this.name = name;
        this.workspace = workspace;
        this.path = path;
    }

    /**
     * Factory to parse labels from a string.. The value could be similar to any
     * of the following forms.
     * <p>
     * :name
     * //foo/bar
     * //foo/bar:quux
     * {@literal @}foo
     * {@literal @}foo//bar
     * {@literal @}foo//bar:baz
     *
     * @param value The value to parse.
     * @return The parsed value in Label form.
     * @throws LabelSyntaxException If the string is not parsable.
     */
    public static Label parse(String value) throws LabelSyntaxException {
        // The regex isn't perfect yet, but prolly good enough. The last case matches when it shouldn't, if you could
        // fix that, that would be awesome
        // TODO(jarenm): use regex from this link: https://regex101.com/r/7LYFhk/1 to parse a label object
        // TODO(jarenm): write test cases to make sure this parse function works, should work as stated in doc above
        // https://regex101.com/r/CSXyZo/1
        throw new LabelSyntaxException();
    }

    public String name() {
        return name;
    }

    public String path() {
        return path;
    }

    public String workspace() {
        return workspace;
    }

    /**
     * Converts this label into it's string literal form.
     *
     * @return A string literal label value.
     */
    public String value() {
        if (name.isEmpty() && path().isEmpty()) {
            return String.format("@%s", workspace());
        }

        if (name().isEmpty()) {
            return String.format("@%s//%s", workspace(), path());
        }

        if (path().isEmpty()) {
            return String.format("@%s//:%s", workspace(), name());
        }

        return String.format("@%s//%s:%s", workspace(), path(), name());
    }

    @Override
    public String toString() {
        return value();
    }
}
