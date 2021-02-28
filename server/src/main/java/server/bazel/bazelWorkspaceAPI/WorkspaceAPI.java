package server.bazel.bazelWorkspaceAPI;

import server.bazel.tree.BuildTarget;
import server.bazel.tree.Package;
import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.bazel.tree.SourceFile;
import server.bazel.tree.WorkspaceTree;
import server.bazel.tree.WorkspaceTree.Node;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public class WorkspaceAPI {
    private static final Logger logger = LogManager.getLogger(WorkspaceAPI.class);

    private WorkspaceTree workspaceTree;

    public WorkspaceAPI(WorkspaceTree workspaceTree) {
        setWorkspace(workspaceTree);
    }

    /**
     *
     * @param workspaceTree an initialized workspace Tree object
     * @return The current WorkspaceAPI object with the newly set workspaceTree
     */
    public WorkspaceAPI setWorkspace(WorkspaceTree workspaceTree) {
        Preconditions.checkNotNull(workspaceTree);
        this.workspaceTree = workspaceTree;
        return this;
    }

    // Publicly available methods
    /**
     *
     * @param currentPath The pathway represented as a String to the package where you want to look for other possible packages
     *          expected format: Path object with format ("/path/to/lastPackage")
     * @return A list of possible paths as Path objects
     *          expected output: list = {/path/to/available/package, ...}
     * @throws WorkspaceAPIException if path is invalid
     */
    public List<Path> findPossibleCompletionsForPath(Path currentPath) throws WorkspaceAPIException {
        ArrayList<Path> allPossiblePaths = new ArrayList<>();
        List<Package> allPossiblePackages = findNodeOfGivenPackagePath(currentPath).getAllPackagesOfChildren();
        for(Package childPackage: allPossiblePackages){
            allPossiblePaths.add(Path.of(childPackage.getPackageName()));
        }
        return allPossiblePaths;
    }

    /**
     *
     * @param pathToPackage The path represented as a string to the package that contains possible Build Targets
     *          expected format: BuildTarget Object where path is "Path.of(//path/to)" and label is null
     *
     * @return A List of Paths, represented by a string, of each possible build target
     *          expected output: list = {BuildTarget(Path.of(//path/to), "targetName", "kindValue)}
     * @throws WorkspaceAPIException if the pathToPackage is an invalid path within the given Workspace
     */
    public List<BuildTarget> findPossibleTargetsForPath(Path pathToPackage) throws WorkspaceAPIException {
        ArrayList<BuildTarget> allPossibleTargets = new ArrayList<>();

        Package packageFromPath =  findNodeOfGivenPackagePath(pathToPackage).getValue();
        for(BuildTarget target: packageFromPath.getBuildTargets()){
            allPossibleTargets.add(new BuildTarget(target.getPath(),target.getLabel(), target.getKind()));
        }
        return  allPossibleTargets;
    }

    /**
     *
     * @param targetToCheck The path, represented by a String, to the given build target
     *          expected format: BuildTarget(Path.of(//path/to), "targetA", "kindValue")
     * @return true if the build target is stored in the workspace tree
     */
    public boolean isValidTarget(BuildTarget targetToCheck){
        logger.info(String.format("Checking if '%s' target is valid.", targetToCheck.toString()));
        Package packageFromPath;
        try {
            packageFromPath =  findNodeOfGivenPackagePath(targetToCheck.getPath()).getValue();
        } catch (WorkspaceAPIException e) {
            logger.info(String.format("Package for target '%s' not present.", targetToCheck.toString()));
            return false;
        }
        List<BuildTarget> buildTargets = packageFromPath.getBuildTargets();
        for(BuildTarget target: buildTargets){
            String buildTargetPath = target.getPathWithTarget();
            if(buildTargetPath.equals(targetToCheck.getPathWithTarget())){
                logger.info(String.format("Package for target '%s' found in package '%s.",
                        targetToCheck.toString(), target.toString()));
                return true;
            }
        }
        logger.info(String.format("Target '%s' is not valid.", targetToCheck.toString()));
        return false;
    }

    /**
     *
     * @param sourceFile The path, represented by a String, to the given build target
     *          expected format: SourceFile object SourceFile("file.java", Path.of(//path/to/file.java))
     * @return true if the sourcefile is stored in the workspace tree at targetPath location
     */
    public boolean isSourceFileInPackage(SourceFile sourceFile){
        Package packageFromPath;
        try {
            packageFromPath = findNodeOfGivenPackagePath(sourceFile.getPath()).getValue();
        } catch (WorkspaceAPIException e) {
            return false;
        }
        List<SourceFile> sourceFiles = packageFromPath.getSourceFiles();
        for(SourceFile target: sourceFiles){
            String sourcePath = target.getPath().toString();
            if(sourcePath.equals(sourceFile.getPath().toString())){
                return true;
            }
        }
        return false;
    }

    /**
     *
     * @param file represents the file that is being searched for
     * @return a Path object that represents Path.of(//path/to/BUILD)
     * @throws WorkspaceAPIException If the source file does not exist on the worktree, this exception is thrown
     */
    public Path findPathToBUILDFromSourceFile(SourceFile file) throws WorkspaceAPIException {
        StringBuilder buildPathString = new StringBuilder();
        if(!isSourceFileInPackage(file)){
            throw new WorkspaceAPIException("Source File does not exist in workTree");
        } else {
            for(int i = 0; i < file.getPath().getNameCount() - 1; i++){
                buildPathString.append("/").append(file.getPath().getName(i));
            }
            buildPathString.append("/BUILD");
        }
        return Path.of(buildPathString.toString());

    }

    // Private methods to be used by the the API

    /**
     *
     * @param path Accepts a path in the given format Path.of("//path/to/package")
     * @return the WorkspaceTree node that represents the given package
     * @throws WorkspaceAPIException if path is not in given workspace tree
     */
    private Node findNodeOfGivenPackagePath(Path path) throws WorkspaceAPIException {
        Node lastNode;

        lastNode = workspaceTree.getRoot();

        for(int i = 0; i < path.getNameCount(); i++){
            String pathSection = path.getName(i).toString();
            if(!pathSection.contains(".")){
                Optional<Node> potentialNode = lastNode.getChild(pathSection);
                if (potentialNode.isEmpty()) {
                    throw new WorkspaceAPIException("Invalid Path");
                } else {
                    lastNode = potentialNode.get();
                }
            }
        }
        return lastNode;
    }

}

