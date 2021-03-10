package server.bazel.interp;

import com.google.common.base.Preconditions;
import server.bazel.tree.BuildTarget;
import server.workspace.Workspace;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * A compatability utilty to help bridge compatability between this package and
 * other Bazel packages. This is needed because the interp package is a WIP and
 * is subject to change.
 * <p>
 * This class will be deleted after Bazel interpretting is complete.
 */
public class CompatabilityUtility {
    private CompatabilityUtility() {
    }

    /**
     * Converts a label to a build target.
     *
     * @param label The label to convert.
     * @param path  The path to the file in which the label is declared. Only used if the label is local.
     * @return The build target.
     */
    public static BuildTarget labelToBuildTarget(Label label, Path path) {
        // Handle local imports differently because the bazel our CLI doesn't support querying for local rules.
        if (label.isLocal()) {
            Preconditions.checkNotNull(path);
            Preconditions.checkArgument(label.hasTarget());
            path = toWorkspaceLocal(path);
            return new BuildTarget(Paths.get("//" + path), label.target().value(), null);
        }

        if (label.hasPkg() && label.hasTarget()) {
            return new BuildTarget(Paths.get("//" + label.pkg().value()), label.target().value(), null);
        }

        if (!label.hasTarget()) {
            // Handle implied packages.
            final String[] parts = label.pkg().value().split("/");
            final String lastPackageName = parts[parts.length - 1];
            return new BuildTarget(Paths.get("//" + label.pkg()), lastPackageName, null);
        }

        // It only has the name.
        return new BuildTarget(Paths.get("//"), label.target().value(), null);
    }

    // TODO(josiahsrc): This behavior should be implied by interp.
    private static Path toWorkspaceLocal(Path path) {
        Preconditions.checkNotNull(path);

        final String wsPathStr = Workspace.getInstance().getRootFolder().getPath().toAbsolutePath().toString();
        final String[] wsPathParts = wsPathStr.split("/");

        final String inPathStr = path.toAbsolutePath().toString();
        final String[] inPathParts = inPathStr.split("/");

        // Convert string to workspace local.
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < inPathParts.length; ++i) {
            if (i >= wsPathParts.length) {
                builder.append(inPathParts[i]);
                if (i < inPathParts.length - 1) {
                    builder.append("/");
                }
            }
        }

        return Paths.get(builder.toString());
    }
}