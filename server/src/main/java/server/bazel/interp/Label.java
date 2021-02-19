package server.bazel.interp;

import server.utils.Nullability;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Represents a Bazel target label. E.g. `@maven//some/other:package_name`.
 */
public class Label {
    private final String name;
    private final String path;
    private final String workspace;

    private Label(String workspace, String path, String name) {
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
        final String workspaceRegex = "(?:(?:@([a-zA-Z0-9_-]+)//)|(?://))";
        final String pathRegex = "([a-zA-Z0-9_-]+(?:/[a-zA-Z0-9_-]+)*)";
        final String nameRegex = "(?::([a-zA-Z0-9_-]+))";
        final String fullRegex = String.format("^%s?%s?%s?$", workspaceRegex, pathRegex, nameRegex);

        // Capturing Groups:
        // 0: Whole value string
        // 1: WORKSPACE name (can be empty)
        // 2: Path (can be empty)
        // 3: Name of rule (can be empty)
        final Pattern pattern = Pattern.compile(fullRegex);
        final Matcher matcher = pattern.matcher(value);

        // Construct a label from the capturing groups.
        Label label;
        if (matcher.find()) {
            String workspaceName = Nullability.nullableOr("", () -> matcher.group(1));
            String path = Nullability.nullableOr("", () -> matcher.group(2));
            String ruleName = Nullability.nullableOr("", () -> matcher.group(3));
            label = new Label(workspaceName, path, ruleName);
        } else {
            throw new LabelSyntaxException();
        }

        // A path in the shape of `@//:` is not supported.
        if (label.workspace().isEmpty() && label.path().isEmpty() && label.name().isEmpty()) {
            throw new LabelSyntaxException();
        }

        return label;
    }

    /**
     * If a label is local, it means that it is referencing something within the same
     * BUILD file. E.g. if a label is `:target_name`, and resides in a BUILD file at
     * `/some/package/BUILD`, then that label would be referencing a label at the Bazel
     * location `//some/package:target_name`.
     *
     * @return Whether this label is a local reference.
     */
    public boolean isLocal() {
        return !hasWorkspace() && !hasPath();
    }

    /**
     * The workspace that this label resides in. For example, if a project depended
     * on a rule from a Maven workspace `@maven//some/other:package`, then this
     * parameter would be equal to `maven`.
     * <p>
     * If empty, this rule is a part of the current workspace.
     *
     * @return The workspace.
     */
    public String workspace() {
        return workspace;
    }

    /**
     * @return Whether the workspace field is declared in this label.
     */
    public boolean hasWorkspace() {
        return !workspace().isEmpty();
    }

    /**
     * The path relative to the workspace file. For example, if a project depended
     * on a rule from a Maven workspace `@maven//some/other:package`, then this
     * parameter would be equal to `some/other`.
     *
     * @return The path.
     */
    public String path() {
        return path;
    }

    /**
     * @return Whether the path field is declared in this label.
     */
    public boolean hasPath() {
        return !path().isEmpty();
    }

    /**
     * The name of the label. This will be the name provided on the declaring rule.
     * For example, if a project depended on a rule from a Maven workspace
     * `@maven//some/other:package_name`, then this parameter would be equal to
     * `package_name`.
     *
     * @return The name.
     */
    public String name() {
        return name;
    }

    /**
     * @return Whether the name field is declared in this label.
     */
    public boolean hasName() {
        return !name().isEmpty();
    }

    /**
     * Converts this label into its string literal form. An example of a string
     * literal form would be `@maven//path/to:package`.
     *
     * @return A string literal label value.
     */
    public String value() {
        if (hasWorkspace()) {
            // A full workspace label.
            if (hasPath() && hasName()) {
                return String.format("@%s//%s:%s", workspace(), path(), name());
            }

            // A label with the name implied from the path.
            if (!hasName()) {
                return String.format("@%s//%s", workspace(), path());
            }

            // A label at the root level of workspace with some id.
            if (!hasPath()) {
                return String.format("@%s//:%s", workspace(), name());
            }

            // A label with the name and path implied from the workspace.
            return String.format("@%s", workspace());
        }

        // A local file label.
        if (!hasPath()) {
            return String.format(":%s", name());
        }

        // A local label with the name implied from the path.
        if (!hasName()) {
            return String.format("//%s", path());
        }

        // A full local workspace label.
        return String.format("//%s:%s", path(), name());
    }

    @Override
    public String toString() {
        return value();
    }
}
