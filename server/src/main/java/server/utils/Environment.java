package server.utils;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class Environment {
    private static final String ENV_PATH_KEY = "PATH";
    private static final Logger logger = LogManager.getLogger(Environment.class);

    private Environment() {

    }

    /**
     * Searches the system PATH for a file with the provided filename. This can be used to locate binaries
     * provided somewhere in the system bins (e.g. /usr/bin). If multiple files match the provided filename,
     * only the first file will be returned.
     *
     * @param fileName The name of the file to locate.
     * @return The path to the file or null if the file wasn't found.
     */
    public static Path searchPath(String fileName) {
        try {
            for (final Path dir : getPathDirs()) {
                final List<Path> files = Files.walk(dir)
                        .filter(path -> Files.isRegularFile(path))
                        .filter(path -> path.getFileName().toString().equals(fileName))
                        .collect(Collectors.toList());

                // Proceed to the next PATH directory.
                if (files.isEmpty()) {
                    continue;
                }

                // Return the first file that matches.
                return files.get(0);
            }
        } catch (IOException e) {
            logger.error("Failed to search path.", e);
        }

        return null;
    }

    /**
     * Parses all PATH directories into a readable path list.
     *
     * @return A list of directories provided in the PATH.
     */
    private static Iterable<Path> getPathDirs() {
        final String PATH_DELIM = ":";

        final Map<String, String> env = System.getenv();
        final String rawPathStr = env.get(ENV_PATH_KEY);
        final String[] parsedPathStrs = rawPathStr.split(PATH_DELIM);

        final List<Path> result = new ArrayList<>();
        for (int i = 0; i < parsedPathStrs.length; ++i) {
            final String pathStr = parsedPathStrs[i];
            final File pathFile = new File(pathStr);
            result.add(pathFile.toPath());
        }

        return result;
    }
}
