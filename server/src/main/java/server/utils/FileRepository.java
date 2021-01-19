package server.utils;

import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.io.IOException;
import java.nio.file.*;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * A file system utility.
 */
public final class FileRepository {
    private static final String ENV_PATH_KEY = "PATH";
    private static final String ENV_PATH_DELIM = ":";
    private static final FileRepository DEFAULT = new FileRepository();
    private static final Logger logger = LogManager.getLogger(FileRepository.class);

    private final FileSystem fileSystem;

    /**
     * Creates a FileRepository using the default file system.
     */
    public FileRepository() {
        fileSystem = FileSystems.getDefault();
    }

    /**
     * Creates a FileRepository from the provided FileSystem.
     *
     * @param fileSystem The file system to use.
     */
    public FileRepository(FileSystem fileSystem) {
        Preconditions.checkNotNull(fileSystem);
        this.fileSystem = fileSystem;
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
     * Gets the associated file system.
     *
     * @return The associated file system.
     */
    public FileSystem getFileSystem() {
        return fileSystem;
    }

    /**
     * Checks to see if a file is executable.
     *
     * @param path The path to check.
     * @return Whether the provided file is executable.
     */
    public boolean isExecutable(Path path) {
        // It's hard to mock this behavior using Jimfs, so it is instead provided as a wrapper here.
        return path.toFile().canExecute();
    }

    /**
     * Checks to see if a file is readable.
     *
     * @param path The path to check.
     * @return Whether the provided file is executable.
     */
    public boolean isReadable(Path path) {
        // It's hard to mock this behavior using Jimfs, so it is instead provided as a wrapper here.
        return path.toFile().canRead();
    }

    /**
     * Checks to see if a file is executable.
     *
     * @param path The path to check.
     * @return Whether the provided file is executable.
     */
    public boolean isWritable(Path path) {
        // It's hard to mock this behavior using Jimfs, so it is instead provided as a wrapper here.
        return path.toFile().canWrite();
    }

    /**
     * Searches the system PATH for a file with the provided filename. This can be used to locate binaries
     * provided somewhere in the system bins (e.g. /usr/bin). If multiple files match the provided filename,
     * only the first file will be returned.
     *
     * @param filename The name of the file to locate.
     * @return The path to the file or null if the file wasn't found.
     */
    public Path searchPATH(String filename) {
        logger.info(String.format("Searching PATH for filename: \"%s\"", filename));

        try {
            for (final Path dir : getPATHDirs()) {
                final List<Path> files = Files.walk(dir)
                        .filter(path -> Files.isRegularFile(path))
                        .filter(path -> path.getFileName().toString().equals(filename))
                        .collect(Collectors.toList());

                // Proceed to the next PATH directory.
                if (files.isEmpty()) {
                    continue;
                }

                // Return the first file that matches.
                final Path path = files.get(0);
                logger.info(String.format("Located filename in PATH: \"%s\"", path));
                return path;
            }

            logger.info(String.format("Unable to find filename \"%s\" in PATH.", filename));
            return null;
        } catch (IOException e) {
            logger.error("Failed to search PATH.", e);
            return null;
        }
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
