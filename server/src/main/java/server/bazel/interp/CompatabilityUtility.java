package server.bazel.interp;

import com.google.common.base.Preconditions;
import server.bazel.tree.BuildTarget;
import server.workspace.Workspace;

import java.nio.file.Path;

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
            Preconditions.checkArgument(label.hasName());
            path = toWorkspaceLocal(path);
            return new BuildTarget(Path.of("//" + path), label.name(), null);
        }

        if (label.hasPkg() && label.hasName()) {
            return new BuildTarget(Path.of("//" + label.pkg()), label.name(), null);
        }

        if (!label.hasName()) {
            // Handle implied packages.
            final String[] parts = label.pkg().split("/");
            final String lastPackageName = parts[parts.length - 1];
            return new BuildTarget(Path.of("//" + label.pkg()), lastPackageName, null);
        }

        // It only has the name.
        return new BuildTarget(Path.of("//"), label.name(), null);
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

        return Path.of(builder.toString());
    }
}
