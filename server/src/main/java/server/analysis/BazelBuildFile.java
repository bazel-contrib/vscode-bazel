package server.analysis;

import java.nio.file.Path;

public class BazelBuildFile extends BazelFile {
    public BazelBuildFile() {
        super();
    }

    public static BazelBuildFile fromPath(Path path) {
        BazelBuildFile file = new BazelBuildFile();
        file.setPath(path);
        return file;
    }
}
