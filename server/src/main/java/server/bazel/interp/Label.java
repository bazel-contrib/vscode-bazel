package server.bazel.interp;

import com.google.common.base.Preconditions;
import server.utils.Nullability;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Represents a Bazel target label. E.g. `@maven//some/other:package_name`.
 */
public class Label {
    private final String workspace;
    private final String root;
    private final String pkg;
    private final String name;

    private Label(String workspace, String root, String pkg, String name) {
        Preconditions.checkNotNull(workspace);
        Preconditions.checkNotNull(root);
        Preconditions.checkNotNull(pkg);
        Preconditions.checkNotNull(name);

        this.workspace = workspace;
        this.root = root;
        this.pkg = pkg;
        this.name = name;
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
        final String workspaceRegex = "(?:@([a-zA-Z0-9._-]+))";
        final String rootRegex = "(//)?";
        final String pkgRegex = "([a-zA-Z0-9._-]+(?:/[a-zA-Z0-9._-]+)*)";
        final String nameRegex = "(?::([a-zA-Z0-9._-]+))";
        final String fullRegex = String.format("^%s?%s?%s?%s?$", workspaceRegex, rootRegex, pkgRegex, nameRegex);

        // Capturing Groups:
        // 0: Whole value string
        // 1: Workspace name (can be empty)
        // 1: Root which represents "//" (can be empty)
        // 2: Package (can be empty)
        // 3: Name of rule (can be empty)
        final Pattern pattern = Pattern.compile(fullRegex);
        final Matcher matcher = pattern.matcher(value);

        // Construct a label from the capturing groups.
        Label label;
        if (matcher.find()) {
            String workspaceName = Nullability.nullableOr("", () -> matcher.group(1));
            String rootName = Nullability.nullableOr("", () -> matcher.group(2));
            String pkgName = Nullability.nullableOr("", () -> matcher.group(3));
            String ruleName = Nullability.nullableOr("", () -> matcher.group(4));
            label = new Label(workspaceName, rootName, pkgName, ruleName);
        } else {
            throw new LabelSyntaxException();
        }

        // A label in the shape of `@//:` is not supported.
        if (!label.hasWorkspace() && !label.hasPkg() && !label.hasName()) {
            throw new LabelSyntaxException();
        }

        if (!label.hasWorkspace() && label.hasPkg() && !label.hasName()) {

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
        return !hasWorkspace() && !hasPkg();
    }

    /**
     * @return
     */
    public boolean isSourceFile() {
        if (!hasPkg()) {
            return false;
        }

        if (hasWorkspace() || hasName()) {
            return false;
        }

        return true;
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
     * The package relative to the workspace file. For example, if a project depended
     * on a rule from a Maven workspace `@maven//some/other:package`, then this
     * parameter would be equal to `some/other`.
     *
     * @return The package.
     */
    public String pkg() {
        return pkg;
    }

    /**
     * @return Whether the package field is declared in this label.
     */
    public boolean hasPkg() {
        return !pkg().isEmpty();
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
            if (hasPkg() && hasName()) {
                return String.format("@%s//%s:%s", workspace(), pkg(), name());
            }

            // A label with the name implied from the package.
            if (!hasName()) {
                return String.format("@%s//%s", workspace(), pkg());
            }

            // A label at the root level of workspace with some id.
            if (!hasPkg()) {
                return String.format("@%s//:%s", workspace(), name());
            }

            // A label with the name and package implied from the workspace.
            return String.format("@%s", workspace());
        }

        // A local file label.
        if (!hasPkg()) {
            return String.format(":%s", name());
        }

        // TODO: If it's a source file, don't append.
        // A local label with the name implied from the package.
        if (!hasName()) {
            return String.format("//%s", pkg());
        }

        // A full local workspace label.
        return String.format("//%s:%s", pkg(), name());
    }

    // TODO(josiahsrc): Create a way to map from any label to a label's full path.
    // public String absolute() {
    //    given :something, return @full//path/to:something
    // }

    @Override
    public String toString() {
        return value();
    }


//    /**
//     * something/asfsdf/asdfasdf/hello.dart
//     */
//    private static boolean isSource
}
