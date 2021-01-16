package server.workspace;

import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Objects;

public class ProjectFolder {
    private Path path;

    private ProjectFolder() {
    }

    public static ProjectFolder fromURI(String uri) {
        return fromURI(URI.create(uri));
    }

    public static ProjectFolder fromURI(URI uri) {
        ProjectFolder result = new ProjectFolder();
        result.path = Paths.get(uri);
        return result;
    }

    public Path getPath() {
        return path;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ProjectFolder that = (ProjectFolder) o;
        return Objects.equals(path, that.path);
    }

    @Override
    public int hashCode() {
        return Objects.hash(path);
    }

    @Override
    public String toString() {
        return "ProjectFolder{" +
                "path=" + path +
                '}';
    }
}
