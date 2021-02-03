package server.bazel.tree;

import java.util.ArrayList;
import java.util.List;

public class Package {
    private String packageName;
    private List<BuildTarget> buildTargets;
    private List<SourceFile> sourceFiles;

    public Package(String packageName) {
        this.packageName = packageName;
        this.buildTargets = new ArrayList<>();
        this.sourceFiles = new ArrayList<>();
    }

    public void addBuildTarget(BuildTarget buildTarget) {
        this.buildTargets.add(buildTarget);
    }

    public void addSourceFile(SourceFile sourceFile) {
        this.sourceFiles.add(sourceFile);
    }

    public String getPackageName() {
        return packageName;
    }

    public List<BuildTarget> getBuildTargets() {
        return buildTargets;
    }

    public List<SourceFile> getSourceFiles() {
        return sourceFiles;
    }

    public boolean hasBuildFile() {
        return !this.buildTargets.isEmpty();
    }
}
