package server.bazel.interp;

import server.utils.Nullability;

import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Represents a Bazel target label. E.g. `@maven//some/other:package_name`.
 */
public class Label {
    private final WorkspaceID workspace;
    private final PkgID pkg;
    private final TargetID target;

    private Label(WorkspaceID workspace, PkgID pkg, TargetID target) {
        this.workspace = workspace;
        this.pkg = pkg;
        this.target = target;
    }

    /**
     * Factory to parse labels from a string. The value could be similar to any
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
        final String rootRegex = "(//)";
        final String pkgRegex = "([a-zA-Z0-9._-]*(?:/[a-zA-Z0-9._-]+)*)";
        final String localityRegex = "(:)";
        final String targetRegex = "([a-zA-Z0-9._-]+(?:/[a-zA-Z0-9._-]+)*)";
        final String fullRegex = String.format("^%s?(?:%s%s)?(?:%s?%s)?$", workspaceRegex, rootRegex,
                pkgRegex, localityRegex, targetRegex);

        // Capturing Groups:
        // 0: Entire label string value.
        // 1: Workspace name (can be empty).
        // 2: Root indicator, e.g. "//" (can be empty).
        // 3: Package path (can be empty).
        // 4: Locality indicator, e.g. ":" (can be empty).
        // 5: Target name of rule (can be empty).
        final Pattern pattern = Pattern.compile(fullRegex);
        final Matcher matcher = pattern.matcher(value);

        // Construct a label from the capturing groups.
        if (!matcher.find()) {
            throw new LabelSyntaxException("Invalid label syntax.");
        }

        final String workspaceValue = matcher.group(1);
        final String rootValue = matcher.group(2);
        final String pkgValue = matcher.group(3);
        final String localityValue = matcher.group(4);
        final String targetValue = matcher.group(5);

        final boolean hasWorkspace = workspaceValue != null;
        final boolean hasRoot = rootValue != null;
        final boolean hasPkg = pkgValue != null;
        final boolean hasLocality = localityValue != null;
        final boolean hasTarget = targetValue != null;

        // An empty label is not a label at all.
        if (!hasWorkspace && !hasPkg && !hasTarget) {
            throw new LabelSyntaxException("A label may not be empty.");
        }

        // A local source file label may only reference files or targets in the same directory.
        if (!hasWorkspace && !hasRoot && !hasPkg && !hasLocality && targetValue.contains("/")) {
            throw new LabelSyntaxException("A label which references a source file may only " +
                    "reference a file within the same directory as the package.");
        }

        // Package paths can be empty.
        return new Label(
                hasWorkspace ? WorkspaceID.fromRaw(workspaceValue) : null,
                hasRoot ? PkgID.fromRaw(Nullability.nullableOr("", () -> pkgValue)) : null,
                hasTarget ? TargetID.fromRaw(hasLocality, targetValue) : null
        );
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
        return !hasWorkspace() && !hasPkg() && hasTarget() && target().isLocal();
    }

    /**
     * Returns whether or not this is a source file reference. A label may only be a
     * source file if it does not have a root, a workspace, or a path. The source file
     * value will effectively be the of the package value (pkg).
     *
     * @return Whether this label represents a source file.
     */
    public boolean isSourceFile() {
        return !hasWorkspace() && !hasPkg() && hasTarget() && target().isSourceFile();
    }

    /**
     * @return Whether the workspace field is declared in this label.
     */
    public boolean hasWorkspace() {
        return workspace() != null;
    }

    /**
     * The workspace that this label resides in. For example, if a project depended
     * on a rule from a Maven workspace `@maven//some/other:package`, then the value
     * of WorkspaceID would be equal to `maven`.
     * <p>
     * If empty, this rule is a part of the current workspace.
     *
     * @return The workspace.
     */
    public WorkspaceID workspace() {
        return workspace;
    }

    /**
     * @return Whether the package field is declared in this label. This is defined
     * by the existence of a `//` after the workspace name.
     */
    public boolean hasPkg() {
        return pkg() != null;
    }

    /**
     * The package relative to the workspace file. For example, if a project depended
     * on a rule from a Maven workspace `@maven//some/other:package`, then the value
     * of the PkgID would be equal to `some/other`.
     *
     * @return The package.
     */
    public PkgID pkg() {
        return pkg;
    }

    /**
     * @return Whether the target field is declared in this label.
     */
    public boolean hasTarget() {
        return target() != null;
    }

    /**
     * The target of the label. This will be the target provided on the declaring rule.
     * For example, if a project depended on a rule from a Maven workspace
     * `@maven//some/other:package_name`, then the value of the target would be equal
     * to `package_name`.
     *
     * @return The target.
     */
    public TargetID target() {
        return target;
    }

    /**
     * Converts this label into its string literal form. An example of a string literal
     * form would be `@maven//path/to:package`. Assumes that this label has been correctly
     * instantiated.
     *
     * @return A string literal label value.
     */
    public String value() {
        final StringBuilder builder = new StringBuilder();

        // Append the "@workspace" if specified.
        if (hasWorkspace()) {
            builder.append(workspace().toString());
        }

        // Append the "//path/to/package" if specified.
        if (hasPkg()) {
            builder.append(pkg().toString());
        }

        // Append the ":name_of_package" if specified.
        if (hasTarget()) {
            builder.append(target().toString());
        }

        return builder.toString();
    }

    // TODO(josiah): Create a way to map from any label to a label's full path.
    // public String absolute(RepositoryMapping mapping) {
    //    given :something, return @full//path/to:something
    // }

    @Override
    public String toString() {
        return value();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Label)) return false;
        Label label = (Label) o;
        return Objects.equals(workspace, label.workspace) &&
                Objects.equals(pkg, label.pkg) &&
                Objects.equals(target, label.target);
    }

    @Override
    public int hashCode() {
        return Objects.hash(workspace, pkg, target);
    }
}
