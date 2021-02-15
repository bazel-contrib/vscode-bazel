package server.bazel.bazelWorkspaceAPI;

import server.bazel.tree.SourceFile;
import server.bazel.tree.WorkspaceTree;
import server.bazel.tree.BuildTarget;
import server.bazel.tree.WorkspaceTree.Node;
import server.bazel.tree.Package;
import server.bazel.bazelWorkspaceAPI.WorkspaceAPI.PathType;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

public class WorkspaceAPI {
    private WorkspaceTree workspaceTree;

    public WorkspaceAPI(WorkspaceTree workspaceTree) throws WorkspaceAPIException {
        if (workspaceTree.getRoot() == null){
            throw new WorkspaceAPIException("Workspace root cannot be null");
        }
        this.workspaceTree = workspaceTree;
    }

    /**
     *
     * @param workspaceTree an initialized workspace Tree object
     * @return The current WorkspaceAPI object with the newly set workspaceTree
     * @throws WorkspaceAPIException if WorkspaceTree has no root
     */
    public WorkspaceAPI setWorkspace(WorkspaceTree workspaceTree) throws WorkspaceAPIException {
        if (workspaceTree.getRoot() == null){
            throw new WorkspaceAPIException("Workspace root cannot be null");
        }
        this.workspaceTree = workspaceTree;
        return this;
    }

    // Publicly available methods


    /**
     *
     * @param currentPath The pathway represented as a String to the package where you want to look for other possible packages
     *          expected format "//path/to/"
     * @return A list of possible paths as Strings
     * @throws WorkspaceAPIException if path is invalid
     */
    public List<String> findPossibleCompletionsForPath(String currentPath) throws WorkspaceAPIException {
        ArrayList<String> allPossiblePaths = new ArrayList<>();
        // This will throw an exception if the path is invalid
        List<Package> allPossiblePackages = findNodeOfGivenPackagePath(PathType.OpenPath, currentPath).getAllPackagesOfChildren();

        for(Package childPackage: allPossiblePackages){
            // I might need to change the / to change based on the Operating system?
            String sb = currentPath +
                    childPackage.getPackageName();
            allPossiblePaths.add(sb);
        }
        return allPossiblePaths;
    }

    /**
     *
     * @param pathToPackage The path represented as a string to the package that contains possible Build Targets
     *          expected format "//path/to:"
     * @return A List of Paths, represented by a string, of each possible build target
     * @Throws WorkspaceAPIException if the pathToPackage is an invalid path within the given Workspace
     */
    public List<String> findPossibleTargetsForPath(String pathToPackage) throws WorkspaceAPIException {
        ArrayList<String> allPossibleTargets = new ArrayList<>();

        Package packageFromPath =  findNodeOfGivenPackagePath(PathType.TargetPath,pathToPackage).getValue();
        for(BuildTarget targets: packageFromPath.getBuildTargets()){
            allPossibleTargets.add(targets.getPathWithTarget());
        }
        return  allPossibleTargets;
    }

    /**
     *
     * @param targetPath The path, represented by a String, to the given build target
     *          expected format "//path/to:targetA"
     * @return true if the build target is stored in the workspace tree
     */
    public boolean isValidTarget(String targetPath){
        Package packageFromPath;
        try {
            packageFromPath =  findNodeOfGivenPackagePath(PathType.TargetPath,targetPath).getValue();
        } catch (WorkspaceAPIException e) {
            return false;
        }
        List<BuildTarget> buildTargets = packageFromPath.getBuildTargets();
        for(BuildTarget target: buildTargets){
            if(target.getPath().equals(targetPath)){
                return true;
            }
        }
        return false;
    }

    /**
     *
     * @param targetPath The path, represented by a String, to the given build target
     *          expected format "//path/to/file.java"
     * @return true if the sourcefile is stored in the workspace tree
     */
    public boolean isSourceFileInPackage(String targetPath){
        Package packageFromPath;
        try {
            packageFromPath =  findNodeOfGivenPackagePath(PathType.FilePath,targetPath).getValue();
        } catch (WorkspaceAPIException e) {
            return false;
        }
        List<SourceFile> sourceFiles = packageFromPath.getSourceFiles();
        for(SourceFile target: sourceFiles){
            if(target.getPath().equals(targetPath)){
                return true;
            }
        }
        return false;
    }

    /**
     *
     * @param pathTofile
     *          expected format "//path/to/source/file.java"
     * @return the Path to the
     */
    public String findBuildTargetsThatDependOnFile(String pathTofile){
        // TODO this may require modifying the BuildTarget object to contain the source files associated with it
        return null;
    } 

    // Private methods to be used by the the API

    /**
     *
     * @param path Accepts a path int he given format "//path/to/package"
     * @return the WorkspaceTree node that represents the given package
     * @throws WorkspaceAPIException
     */
    private Node findNodeOfGivenPackagePath(PathType type,String path) throws WorkspaceAPIException {
        Node lastNode;

        lastNode = workspaceTree.getRoot();
        String[] packages = getPackageAsAnArray(type, path);

        for(int i = 1; i < packages.length; i ++){
            lastNode = lastNode.getChild(packages[i]).get();
        }

        return lastNode;
    }

    private String[] getPackageAsAnArray(PathType type, String givenPath){
        // Assert that the root path was passed, may need to be variable based on operating system.
        assert givenPath.length() >= 2;
        assert givenPath.charAt(0) == '/';
        assert givenPath.charAt(1) == '/';
        String[] packages;
        if(givenPath.length() == 2){
            packages = new String[]{"/"};
        } else {
            packages = givenPath.substring(1).split("/");
            packages[0] = "/";
        }
        int lastIndex = packages.length-1;
        switch (type){
            case TargetPath: {
                assert packages[lastIndex].contains(":");
                return Arrays.copyOfRange(packages,0,lastIndex);
            }
            case OpenPath:{
                return packages;
            }
            case FilePath:{
                assert packages[lastIndex].contains(".");
                return Arrays.copyOfRange(packages,0,lastIndex);
            }

        }
        return packages;
    }

    enum PathType
    {
        TargetPath, OpenPath, FilePath;
    }

}
