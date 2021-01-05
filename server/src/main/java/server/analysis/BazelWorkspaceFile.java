package server.analysis;

import java.nio.file.Path;

public class BazelWorkspaceFile extends BazelFile {
    public BazelWorkspaceFile() {
        super();
    }

    public static BazelWorkspaceFile fromPath(Path path) {
        BazelWorkspaceFile file = new BazelWorkspaceFile();
        file.setPath(path);
        return file;
    }
}