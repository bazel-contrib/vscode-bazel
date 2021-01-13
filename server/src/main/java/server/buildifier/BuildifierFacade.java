package server.buildifier;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.utils.Environment;
import server.workspace.ExtensionConfig;
import server.workspace.Workspace;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;

public class BuildifierFacade {
    private static final String DEFAULT_BUILDIFIER_NAME = "buildifier";

    private static final Logger logger = LogManager.getLogger(BuildifierFacade.class);

    private BuildifierFacade() {

    }

    public static boolean buildifierExists() {
        final Path path = getBuildifierPath();
        return path != null;
    }

    private static Path getBuildifierPath() {
        final ExtensionConfig config = Workspace.getInstance().getExtensionConfig();

        logger.info("Locating buildifier.");

        // The extension config path will take priority over the inferred paths. Try
        // to load the buildifier from the extension configuration.
        {
            final Path path = Paths.get(config.getBazel().getBuildifier().getExecutable());
            final File file = path.toFile();
            final LinkOption linkOption = LinkOption.NOFOLLOW_LINKS;
            if (Files.exists(path, linkOption) && file.canExecute()) {
                logger.info("Buildifer was located from the configuration settings.");
                return path;
            }
        }

        // Try to find the buildifier in the system PATH.
        {
            final Path execPath = Environment.searchPath(DEFAULT_BUILDIFIER_NAME);
            if (execPath != null) {
                logger.info("Buildifier was located from the system PATH.");
                return execPath;
            }
        }

        logger.info("Buildifier not found.");
        return null;
    }
}
