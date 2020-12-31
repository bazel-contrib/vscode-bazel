package server.analysis;

import java.nio.file.Path;

public class AnalyzerConfig {
    private Path rootPath;

    public Path getRootPath() {
        return rootPath;
    }

    public void setRootPath(Path rootPath) {
        this.rootPath = rootPath;
    }
}
