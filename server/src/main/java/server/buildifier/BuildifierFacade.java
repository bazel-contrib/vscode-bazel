package server.buildifier;

import server.workspace.ExtensionConfig;
import server.workspace.Workspace;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;

public class BuildifierFacade {
    private BuildifierFacade() {

    }

    public static boolean buildifierExists() {
        final Path path = getBuildifierPath();
        return path != null;
    }

    private static Path getBuildifierPath() {
        final ExtensionConfig config = Workspace.getInstance().getExtensionConfig();

        // The extension config path will take priority over the inferred paths. Try
        // to load the buildifier from the extension configuration.
        {
            final Path path = Paths.get(config.getBazel().getBuildifier().getExecutable());
            final File file = path.toFile();
            final LinkOption linkOption = LinkOption.NOFOLLOW_LINKS;
            if (Files.exists(path, linkOption) && file.canExecute()) {
                return path;
            }
        }

        // Try to find the buildifier in the system PATH.
        {

        }

        return null;
    }
}
