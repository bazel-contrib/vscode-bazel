package server.bazel.tree;

import java.nio.file.Path;

public class SourceFile {
    private Path path;
    private String fileName;
    private String fileExtension;

    public SourceFile(String fileName, Path path) {
        String[] parts = fileName.split("\\.");
        this.fileName = parts[0];
        if(parts.length > 1) {
            this.fileExtension = parts[1];
        } else {
            this.fileExtension = "";
        }
        this.path = path;
    }

    public Path getPath() {
        return path;
    }

    public String getFileName() {
        return fileName;
    }

    public String getFileExtension() {
        return fileExtension;
    }

    public String getFileNameWithExtension() {
        if(fileExtension == null) {
            return getFileName();
        }
        return String.format("%s.%s", fileName, fileExtension);
    }

    @Override
    public String toString() {
        return "SourceFile{" +
                "path=" + path +
                ", fileName='" + fileName + '\'' +
                ", fileExtension='" + fileExtension + '\'' +
                '}';
    }
}
