package server.analysis;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

class Utilities {
    private static final Pattern WORKSPACE_FILE_NAME_REGEX = Pattern.compile("^WORKSPACE(.bazel)?$");
    private static final Pattern BUILD_FILE_NAME_REGEX = Pattern.compile("^BUILD(.bazel)?$");

    private Utilities() {

    }

    public static boolean isWorkspaceFile(Path path) {
        return pathMatchesFile(path, WORKSPACE_FILE_NAME_REGEX);
    }

    public static boolean isBuildFile(Path path) {
        return pathMatchesFile(path, BUILD_FILE_NAME_REGEX);
    }

    private static boolean pathMatchesFile(Path path, Pattern pattern) {
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            return false;
        }

        Matcher m = pattern.matcher(path.getFileName().toString());
        return m.matches();
    }
}
