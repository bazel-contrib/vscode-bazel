package server.analysis;

import java.nio.file.Path;

public class BazelFile {
    private Path path;

    public BazelFile() {
        path = null;
    }

    public Path getPath() {
        return path;
    }

    void setPath(Path path) {
        this.path = path;
    }
}
