package server.starlark;

import java.nio.file.Path;

public class ParseInput {
    private Path filePath;

    public Path getFilePath() {
        return filePath;
    }

    public void setFilePath(Path filePath) {
        this.filePath = filePath;
    }
}
