package server.bazel.bazelWorkspaceAPI;

import server.bazel.tree.SourceFile;
import server.bazel.tree.WorkspaceTree;
import server.bazel.tree.BuildTarget;
import server.bazel.tree.WorkspaceTree.Node;
import server.bazel.tree.Package;

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
     *          expected output: list = {//path/to/available, ...}
     * @throws WorkspaceAPIException if path is invalid
     */
    public List<String> findPossibleCompletionsForPath(String currentPath) throws WorkspaceAPIException {
        ArrayList<String> allPossiblePaths = new ArrayList<>();
        // This will throw an exception if the path is invalid
        List<Package> allPossiblePackages = findNodeOfGivenPackagePath(PathType.PACKAGE_PATH, currentPath).getAllPackagesOfChildren();

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
     *
     * @return A List of Paths, represented by a string, of each possible build target
     *          expected output: list = {//path/to/target:target, ....}
     * @throws WorkspaceAPIException if the pathToPackage is an invalid path within the given Workspace
     */
    public List<String> findPossibleTargetsForPath(String pathToPackage) throws WorkspaceAPIException {
        ArrayList<String> allPossibleTargets = new ArrayList<>();

        Package packageFromPath =  findNodeOfGivenPackagePath(PathType.BUILT_TARGET_PATH,pathToPackage).getValue();
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
            packageFromPath =  findNodeOfGivenPackagePath(PathType.BUILT_TARGET_PATH,targetPath).getValue();
        } catch (WorkspaceAPIException e) {
            return false;
        }
        List<BuildTarget> buildTargets = packageFromPath.getBuildTargets();
        for(BuildTarget target: buildTargets){
            String buildTargetPath = target.getPathWithTarget();
            if(buildTargetPath.equals(targetPath)){
                return true;
            }
        }
        return false;
    }

    /**
     *
     * @param targetPath The path, represented by a String, to the given build target
     *          expected format "//path/to/file.java"
     * @return true if the sourcefile is stored in the workspace tree at targetPath location
     */
    public boolean isSourceFileInPackage(String targetPath){
        Package packageFromPath;
        try {
            packageFromPath =  findNodeOfGivenPackagePath(PathType.FILE_PATH,targetPath).getValue();
        } catch (WorkspaceAPIException e) {
            return false;
        }
        List<SourceFile> sourceFiles = packageFromPath.getSourceFiles();
        for(SourceFile target: sourceFiles){
            String sourcePath = target.getPath().toString();
            if(sourcePath.equals(targetPath)){
                return true;
            }
        }
        return false;
    }

    // Private methods to be used by the the API

    /**
     *
     * @param path Accepts a path in the given format "//path/to/package"
     * @return the WorkspaceTree node that represents the given package
     * @throws WorkspaceAPIException if path is not in given workspace tree
     */
    private Node findNodeOfGivenPackagePath(PathType type,String path) throws WorkspaceAPIException {
        Node lastNode;

        lastNode = workspaceTree.getRoot();
        String[] packages = getPackageAsAnArray(type, path);

        for(int i = 1; i < packages.length; i ++){
            Optional<WorkspaceTree.Node> potentialNode = lastNode.getChild(packages[i]);
            if(potentialNode.isEmpty()){
                throw new WorkspaceAPIException("Invalid Path");
            } else {
                lastNode = lastNode.getChild(packages[i]).get();
            }
        }

        return lastNode;
    }

    /**
     *
     * @param type an enumerator to represent TargetPath, OpenPath, FilePath
     * @param givenPath The path to the given target, package, or file
     *          expected format "//path/to:target" or "//path/to/package" or "//path/to/file.java"
     * @return An Array of strings representing the package
     *          expected format ["path", "to", "package"]
     *          TargetPaths and filePath returns will not contain the file.java or :target int he return array
     * @throws WorkspaceAPIException If filepath is bad, does not start at root, or doesn't match given type
     */
    private String[] getPackageAsAnArray(PathType type, String givenPath) throws WorkspaceAPIException {
        // Assert that the root path was passed, may need to be variable based on operating system.
        if (givenPath == null){
            throw new WorkspaceAPIException("Given File Path is null");
        }
        if (givenPath.length() < 2){
            throw new WorkspaceAPIException("Given File Path does not start at Root");
        }
        if(givenPath.charAt(0) != '/' |
                givenPath.charAt(1) != '/') {
            throw  new WorkspaceAPIException("Given File Path does not start at Root");
        }
        String[] packages;
        if(givenPath.length() == 2){
            packages = new String[]{"/"};
        } else {
            packages = givenPath.substring(1).split("/");
            packages[0] = "/";
        }
        int lastIndex = packages.length-1;
        switch (type){
            case BUILT_TARGET_PATH: {
                if(!packages[lastIndex].contains(":")){
                    throw new WorkspaceAPIException("No build target specified in given path");
                }
                String[] clean = packages[lastIndex].split(":");
                if(clean.length == 0){
                    return Arrays.copyOfRange(packages,0,lastIndex);
                }
                packages[lastIndex] = clean[0];
                return packages;
            }
            case PACKAGE_PATH:{
                return packages;
            }
            case FILE_PATH:{
                if(!packages[lastIndex].contains(".")){
                    throw new WorkspaceAPIException("No file specified in given path");
                }
                return Arrays.copyOfRange(packages,0,lastIndex);
            }

        }
        return packages;
    }

    enum PathType
    {
        BUILT_TARGET_PATH, PACKAGE_PATH, FILE_PATH
    }

}
