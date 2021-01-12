package server.buildifier;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.workspace.ExtensionConfig;
import server.workspace.Workspace;

import java.io.File;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

public class BuildifierFacade {
    private static final String DEFAULT_BUILDIFIER_ENV_NAME = "buildifier";

    private static final Logger logger = LogManager.getLogger(BuildifierFacade.class);

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
            final Map<String, String> env = System.getenv();
            if (env.containsKey(DEFAULT_BUILDIFIER_ENV_NAME)) {
                final String execPath = env.get(DEFAULT_BUILDIFIER_ENV_NAME);
                final URI execURI = URI.create(execPath);
                return Paths.get(execURI);
            }
        }

        return null;
    }
}
