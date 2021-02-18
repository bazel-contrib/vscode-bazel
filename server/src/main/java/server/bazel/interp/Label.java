package server.bazel.interp;

import server.utils.Nullability;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

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
        Pattern pattern = Pattern.compile(fullRegex);
        Matcher matcher = pattern.matcher(value);
        if (matcher.find()) {
            String workspaceName = Nullability.nullableOr("", () -> matcher.group(1));
            String path = Nullability.nullableOr("", () -> matcher.group(2));
            String ruleName = Nullability.nullableOr("", () -> matcher.group(3));
            return new Label(workspaceName, path, ruleName);
        }

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
     * Converts this label into its string literal form. An example of a string literal form
     * would be `@maven//path/to:package`.
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
