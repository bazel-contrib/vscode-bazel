package server.bazel.domain;

import java.nio.file.Path;

public class SourceFile {
    private Path path;
    private String fileName;

    public SourceFile(String fileName, Path path) {
        this.fileName = fileName;
        this.path = path;
    }

    public Path getPath() {
        return path;
    }

    public String getFileName() {
        return fileName;
    }
}
