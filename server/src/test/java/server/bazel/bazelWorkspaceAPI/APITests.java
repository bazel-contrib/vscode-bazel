package server.bazel.bazelWorkspaceAPI;

import java.util.ArrayList;
import java.util.List;
import java.nio.file.Path;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import static org.mockito.Mockito.*;

import server.bazel.tree.BuildTarget;
import server.bazel.tree.Package;
import server.bazel.tree.WorkspaceTree;

public class APITests {

    WorkspaceTree simpleWorkSpaceTree;
    WorkspaceTree complex;

    Path package1Mock = mock(Path.class);
    Path package2Mock = mock(Path.class);
    Path package6Mock = mock(Path.class);

    @Before
    public void setup() {
        Package workspaceRoot = new Package("/");
        Package package1 = new Package("main");
        Package package2 = new Package("lib");
        Package package3 = new Package("bazelLib");
        Package package4 = new Package("bazelLib1");
        Package package5 = new Package("bazelLib2");
        Package package6 = new Package("bazelLib3");

        when(package2Mock.toString()).thenReturn("//lib");
        when(package1Mock.toString()).thenReturn("//main");
        when(package6Mock.toString()).thenReturn("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3");

        simpleWorkSpaceTree = new WorkspaceTree(workspaceRoot);

        simpleWorkSpaceTree.getRoot().addChild(package1);
        simpleWorkSpaceTree.getRoot().addChild(package2);
        simpleWorkSpaceTree.getRoot().getChild("lib").get().addChild(package3);
        simpleWorkSpaceTree.getRoot().getChild("lib").get().getChild("bazelLib").get().addChild(package4);
        simpleWorkSpaceTree.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .addChild(package5);
        simpleWorkSpaceTree.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .getChild("bazelLib2").get().addChild(package6);

        BuildTarget buildTargetP2_1 = new BuildTarget(package2Mock,"java_build_target", "java");
        BuildTarget buildTargetP2_2 = new BuildTarget(package2Mock,"java_build_target_2", "java");

        BuildTarget buildTargetP2_3 = new BuildTarget(package6Mock,"java_build_target_3", "java");
        BuildTarget buildTargetP2_4 = new BuildTarget(package6Mock,"java_build_target_4", "java");

        simpleWorkSpaceTree.getRoot().getChild("lib").get().getValue().addBuildTarget(buildTargetP2_1);
        simpleWorkSpaceTree.getRoot().getChild("lib").get().getValue().addBuildTarget(buildTargetP2_2);

        simpleWorkSpaceTree.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .getChild("bazelLib2").get().getChild("bazelLib3").get().getValue().addBuildTarget(buildTargetP2_3);

        simpleWorkSpaceTree.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .getChild("bazelLib2").get().getChild("bazelLib3").get().getValue().addBuildTarget(buildTargetP2_4);
    }

    @Test
    public void doesSettingAndCreatingAPIWork() {
        try {
            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
        } catch (WorkspaceAPIException e) {
            assert false;
        }
    }

    @Test
    public void should_returnStringList_With_correctChildPackageValues () {
        try{
            List<String> paths = new ArrayList<>();
            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
            paths = workspaceAPI.findPossibleCompletionsForPath("//");
            System.out.println(paths);
            Assert.assertTrue(paths.contains("//main"));
            Assert.assertTrue(paths.contains("//lib"));
        } catch (Exception e){
            Assert.assertTrue(false);
        }
    }

    @Test
    public void should_returnCorrectStrings_With_longPackage () {
        try{
            List<String> paths = new ArrayList<>();

            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
            paths = workspaceAPI.findPossibleCompletionsForPath("//");
            Assert.assertEquals(2, paths.size());
            Assert.assertTrue(paths.contains("//main"));
            Assert.assertTrue(paths.contains("//lib"));

            paths = workspaceAPI.findPossibleCompletionsForPath("//lib/");
            Assert.assertEquals(1, paths.size());
            Assert.assertTrue(paths.contains("//lib/bazelLib"));

            paths = workspaceAPI.findPossibleCompletionsForPath("//lib/bazelLib/");
            Assert.assertEquals(1, paths.size());
            Assert.assertTrue(paths.contains("//lib/bazelLib/bazelLib1"));

            paths = workspaceAPI.findPossibleCompletionsForPath("//lib/bazelLib/bazelLib1/");
            Assert.assertEquals(1, paths.size());
            Assert.assertTrue(paths.contains("//lib/bazelLib/bazelLib1/bazelLib2"));

            paths = workspaceAPI.findPossibleCompletionsForPath("//lib/bazelLib/bazelLib1/bazelLib2/");
            Assert.assertEquals(1, paths.size());
            Assert.assertTrue(paths.contains("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3"));

            paths = workspaceAPI.findPossibleCompletionsForPath("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/");
            Assert.assertEquals(0, paths.size());

        } catch (Exception e){
            Assert.assertTrue(false);
        }
    }

    @Test
    public void should_returnBuildTargetStrings_With_longPackage () {
        try{
            List<String> paths = new ArrayList<>();

            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
            paths = workspaceAPI.findPossibleTargetsForPath("//:");
            Assert.assertEquals(0, paths.size());

            paths = workspaceAPI.findPossibleTargetsForPath("//lib:");
            Assert.assertEquals(2, paths.size());
            Assert.assertTrue(paths.contains("//lib:java_build_target"));
            Assert.assertTrue(paths.contains("//lib:java_build_target_2"));

            paths = workspaceAPI.findPossibleTargetsForPath("//lib/bazelLib:");
            Assert.assertEquals(0, paths.size());

            paths = workspaceAPI.findPossibleTargetsForPath("//lib/bazelLib/bazelLib1:");
            Assert.assertEquals(0, paths.size());

            paths = workspaceAPI.findPossibleTargetsForPath("//lib/bazelLib/bazelLib1/bazelLib2:");
            Assert.assertEquals(0, paths.size());

            paths = workspaceAPI.findPossibleTargetsForPath("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3:");
            Assert.assertEquals(2, paths.size());
            Assert.assertTrue(paths.contains("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3:java_build_target_3"));
            Assert.assertTrue(paths.contains("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3:java_build_target_4"));

        } catch (Exception e){
            Assert.fail();
        }
    }

}
