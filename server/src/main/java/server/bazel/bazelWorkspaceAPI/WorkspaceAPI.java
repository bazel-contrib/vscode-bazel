package server.bazel.bazelWorkspaceAPI;

import server.src.main.java.server.bazel.tree.*;

public class WorkspaceAPI {
    private Workspace workspace;

    public WorkspaceAPI(Workspace workspace){
        this.workspace = workspace;
    };

    public WorkspaceAPI setWorkspace(Workspace workspace){
        this.workspace = workspace;
    }

    // Publicly available methods
    public List<String> findPossibleCompletionsForPath(String currentPath){
        // Traverse the given workspace tree until the node = the path of the current path
        // Throw errors if path doesn't exist 
        // Return the path of all childNodes at the last package of the currentPath Variable

        // Return all Paths to those packages as a list of Strings
        // Return empty String list if there are no available paths 
        return null;
    }

    public List<String> findPossibleTargetsfor(String pathToPackage){
        // Traverse the Workspace tree until arriving at the node that represents the last package of the pathToPackage
        // retrieve the list of buildTargets found in that package
        // retrieve the path of each possible Buildtarget
        // return as a list of Strings containing the path to the build target
        // if no targets, return an empty String list 
        return null;
    }

    public boolean isValidTarget(String targetPath){
        // attempt to traverse to the last package of the target path 
        // if package exists continue, else return false
        // retrieve the PAckage object that should contain the target. 
        // Retrieve all BuildTaregts found in the package. 
        // compare the BuiltargetPath to the given targetPath
        // if a match is found return true
        // else return false. 
        return false;
    }

    public List<BuildTarget> findBuildTargetsThatDependOnFile(String pathTofile){
        // TODO this may require modifying the BuildTarget object to contain the sourcefiles associated with it 
        return null;
    } 

    // Private methods to be used by the the API

    private Package returnPackageAtGivenPath(String path){
        return null;
    }
}