package server.bazel.tree;

import java.nio.file.Path;
import java.util.Objects;

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

    public String getPathWithTarget() {
        // Path truncates the first "/".
        return String.format("/%s:%s", path.toString(), label);
    }

    @Override
    public int hashCode() {
        return Objects.hash(kind, label, path);
    }

    @Override
    public boolean equals(Object o) {
        if (o == this) {
            return true;
        } else if (!(o instanceof BuildTarget)) {
            return false;
        }

        BuildTarget c = (BuildTarget) o;
        return getPath().toString().equals(c.getPath().toString())
                && getKind().equals(c.getKind())
                && getLabel().equals(c.getLabel());
    }

    @Override
    public String toString() {
        return "BuildTarget{" +
                "path=" + path +
                ", label='" + label + '\'' +
                ", kind='" + kind + '\'' +
                '}';
    }
}
