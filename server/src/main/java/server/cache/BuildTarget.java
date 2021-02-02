package server.cache;

import java.nio.file.Path;

public class BuildTarget {
    private Path path;
    private String label;
    private String kind;

    public BuildTarget(Path path, String label, String kind) {
        this.path = path;
        this.label = label;
        this.kind = kind;
    }

    public Path getPath() {
        return path;
    }

    public String getLabel() {
        return label;
    }

    public String getKind() {
        return kind;
    }
}
