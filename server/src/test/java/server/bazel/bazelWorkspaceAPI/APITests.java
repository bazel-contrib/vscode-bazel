package server.bazel.bazelWorkspaceAPI;

import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import server.bazel.tree.Package;
import server.bazel.tree.WorkspaceTree;


public class APITests {

  WorkspaceTree simpleWorkSpaceTree;
  WorkspaceTree complex;

  @Before
  public void setup() {
    Package workspaceRoot = new Package("/");
    Package package1 = new Package("main");
    Package Package2 = new Package("lib");

    simpleWorkSpaceTree.getRoot().addChild(package1);
    simpleWorkSpaceTree.getRoot().addChild(Package2);
  }

  @Test
  public void doesSettingAndCreatingAPIWork(){
    try{
      WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
    } catch ( WorkspaceAPIException e){
      assert false;
    }

  }
}
