package server.utils;

import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.nio.file.FileSystem;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * A file system utility which can be mocked.
 */
public final class FileRepository {
    private static final String ENV_PATH_KEY = "PATH";
    private static final String ENV_PATH_DELIM = ":";
    private static final FileRepository DEFAULT = new FileRepository();
    private static final Logger logger = LogManager.getLogger(FileRepository.class);

    private final FileSystem fileSystem;

    public FileRepository() {
        fileSystem = FileSystems.getDefault();
    }

    public FileRepository(FileSystem fileSystem) {
        Preconditions.checkNotNull(fileSystem);
        this.fileSystem = fileSystem;
    }

    /**
     * Gets the current file system.
     *
     * @return The current file system.
     */
    public FileSystem getFileSystem() {
        return fileSystem;
    }

    /**
     * Gets the default file respository which uses the default files system.
     *
     * @return The default file respository.
     */
    public static FileRepository getDefault() {
        return DEFAULT;
    }

    /**
     * Searches the system PATH for a file with the provided filename. This can be used to locate binaries
     * provided somewhere in the system bins (e.g. /usr/bin). If multiple files match the provided filename,
     * only the first file will be returned.
     *
     * @param fileName The name of the file to locate.
     * @return The path to the file or null if the file wasn't found.
     */
    public Path searchPATH(String fileName) {
        try {
            for (final Path dir : getPATHDirs()) {
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
            logger.error("Failed to search PATH.", e);
        }

        return null;
    }

    /**
     * Parses all PATH directories into a readable path list.
     *
     * @return A list of directories provided in the PATH.
     */
    private Iterable<Path> getPATHDirs() {
        final Map<String, String> env = System.getenv();
        final String rawPathStr = env.get(ENV_PATH_KEY);
        final String[] parsedPathStrs = rawPathStr.split(ENV_PATH_DELIM);

        final List<Path> result = new ArrayList<>();
        for (final String pathStr : parsedPathStrs) {
            result.add(fileSystem.getPath(pathStr));
        }

        return result;
    }
}
