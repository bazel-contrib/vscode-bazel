package server.bazel.bazelWorkspaceAPI;

import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.nio.file.Paths;
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
import server.bazel.tree.SourceFile;
import server.bazel.tree.WorkspaceTree;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class APITests {

    WorkspaceTree simpleWorkSpaceTree;
    WorkspaceTree remoteWorkspaceTree;

    Path package1Mock = mock(Path.class);
    Path package2Mock = mock(Path.class);
    Path package6Mock = mock(Path.class);
    Path source1Mock = mock(Path.class);
    Path source2Mock = mock(Path.class);
    Path source3Mock = mock(Path.class);
    Path source4Mock = mock(Path.class);
    Path source5Mock = mock(Path.class);
    Package package1;
    Package package2;
    Package package3;
    Package package4;
    Package package5;
    Package package6;

    @Before
    public void setup() {
        package1 = new Package("main");
        package2 = new Package("lib");
        package3 = new Package("bazelLib");
        package4 = new Package("bazelLib1");
        package5 = new Package("bazelLib2");
        package6 = new Package("bazelLib3");

        when(package2Mock.toString()).thenReturn("/lib");
        when(package1Mock.toString()).thenReturn("/main");
        when(package6Mock.toString()).thenReturn("/lib/bazelLib/bazelLib1/bazelLib2/bazelLib3");
        when(source1Mock.toString()).thenReturn("/main/main.java");
        when(source2Mock.toString()).thenReturn("/main/file2.java");
        when(source3Mock.toString()).thenReturn("/main/file3.java");
        when(source4Mock.toString()).thenReturn("/lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/file4.java");
        when(source5Mock.toString()).thenReturn("/lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/file5.java");

        simpleWorkSpaceTree = initializeSimpleWorkSpaceTree();
        remoteWorkspaceTree = initializeSimpleRemoteWorkSpaceTree();

    }

    @Test
    public void doesSettingAndCreatingAPIWork() {
        WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
    }

    @Test
    public void should_returnStringList_With_correctChildPackageValues() {
        try {
            List<Path> paths = new ArrayList<>();
            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);

            paths = workspaceAPI.findPossibleCompletionsForPath(Paths.get("//"));
            Assert.assertTrue(paths.contains(Paths.get("main")));
            Assert.assertTrue(paths.contains(Paths.get("lib")));
        } catch (Exception e) {
            Assert.assertTrue(false);
        }
    }

    @Test
    public void should_returnCorrectStrings_With_longPackage() {
        try {
            List<Path> paths = new ArrayList<>();

            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
            paths = workspaceAPI.findPossibleCompletionsForPath(Paths.get("//"));
            Assert.assertEquals(2, paths.size());
            Assert.assertTrue(paths.contains(Paths.get("main")));
            Assert.assertTrue(paths.contains(Paths.get("lib")));

            paths = workspaceAPI.findPossibleCompletionsForPath(Paths.get("//lib/"));
            Assert.assertEquals(1, paths.size());
            Assert.assertTrue(paths.contains(Paths.get("bazelLib")));

            paths = workspaceAPI.findPossibleCompletionsForPath(Paths.get("//lib/bazelLib/"));
            Assert.assertEquals(1, paths.size());
            Assert.assertTrue(paths.contains(Paths.get("bazelLib1")));

            paths = workspaceAPI.findPossibleCompletionsForPath(Paths.get("//lib/bazelLib/bazelLib1/"));
            Assert.assertEquals(1, paths.size());
            Assert.assertTrue(paths.contains(Paths.get("bazelLib2")));

            paths = workspaceAPI.findPossibleCompletionsForPath(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/"));
            Assert.assertEquals(1, paths.size());
            Assert.assertTrue(paths.contains(Paths.get("bazelLib3")));

            paths = workspaceAPI.findPossibleCompletionsForPath(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/"));
            Assert.assertEquals(0, paths.size());

        } catch (Exception e) {
            Assert.fail();
        }
    }

    @Test
    public void should_returnBuildTargetStrings_With_longPackage() {
        try {
            List<BuildTarget> buildTargets = new ArrayList<>();

            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
            BuildTarget rootTargets = new BuildTarget(Paths.get("//"), null, "kind");
            buildTargets = workspaceAPI.findPossibleTargetsForPath(rootTargets.getPath());
            Assert.assertEquals(0, buildTargets.size());

            BuildTarget libTargets = new BuildTarget(Paths.get("//lib"), null, "kind");
            buildTargets = workspaceAPI.findPossibleTargetsForPath(libTargets.getPath());
            Assert.assertEquals(2, buildTargets.size());
            BuildTarget correctTarget1 = new BuildTarget(Paths.get("//lib"), "java_build_target", "kind");
            BuildTarget correctTarget2 = new BuildTarget(Paths.get("//lib"), "java_build_target_2", "kind");
            Assert.assertTrue(buildTargets.contains(correctTarget1));
            Assert.assertTrue(buildTargets.contains(correctTarget2));

            BuildTarget bazelLibTargets = new BuildTarget(Paths.get("//lib/bazelLib"), null, "kind");
            buildTargets = workspaceAPI.findPossibleTargetsForPath(bazelLibTargets.getPath());
            Assert.assertEquals(0, buildTargets.size());

            BuildTarget bazelLib1Targets = new BuildTarget(Paths.get("//lib/bazelLib/bazelLib1"), null, "kind");
            buildTargets = workspaceAPI.findPossibleTargetsForPath(bazelLibTargets.getPath());
            Assert.assertEquals(0, buildTargets.size());

            BuildTarget bazelLib2Targets = new BuildTarget(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2"), null, "kind");
            buildTargets = workspaceAPI.findPossibleTargetsForPath(bazelLib2Targets.getPath());
            Assert.assertEquals(0, buildTargets.size());

            BuildTarget bazelLib3Targets = new BuildTarget(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3"), null, "kind");
            buildTargets = workspaceAPI.findPossibleTargetsForPath(bazelLib3Targets.getPath());
            Assert.assertEquals(2, buildTargets.size());
            Assert.assertTrue(buildTargets.contains(new BuildTarget(Paths.get("/lib/bazelLib/bazelLib1/bazelLib2/bazelLib3"), "java_build_target_3", "kind")));
            Assert.assertTrue(buildTargets.contains(new BuildTarget(Paths.get("/lib/bazelLib/bazelLib1/bazelLib2/bazelLib3"), "java_build_target_4", "kind")));

        } catch (Exception e) {
            Assert.fail();
        }
    }

    @Test
    public void validTargets_should_returnTrue_With_longPackage() {
        try {
            boolean isValid;

            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
            BuildTarget build1 = new BuildTarget(Paths.get("//lib"), "java_build_target", "kind");
            isValid = workspaceAPI.isValidTarget(build1);
            Assert.assertTrue(isValid);

            BuildTarget build2 = new BuildTarget(Paths.get("//lib"), "java_build_target_2", "kind");
            isValid = workspaceAPI.isValidTarget(build2);
            Assert.assertTrue(isValid);

            BuildTarget build3 = new BuildTarget(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3"), "java_build_target_3", "kind");
            isValid = workspaceAPI.isValidTarget(build3);
            Assert.assertTrue(isValid);

            BuildTarget build4 = new BuildTarget(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3"), "java_build_target_4", "kind");
            isValid = workspaceAPI.isValidTarget(build4);
            Assert.assertTrue(isValid);

        } catch (Exception e) {
            Assert.fail();
        }
    }

    @Test
    public void invalidTargets_should_returnFalse_With_longPackage() {
        try {
            boolean isValid;

            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);

            BuildTarget build1 = new BuildTarget(Paths.get("//lib"), "java_build_target_3", "kind");
            isValid = workspaceAPI.isValidTarget(build1);
            Assert.assertFalse(isValid);

            BuildTarget build2 = new BuildTarget(Paths.get("//lib"), "java_build_target_4", "kind");
            isValid = workspaceAPI.isValidTarget(build2);
            Assert.assertFalse(isValid);

            BuildTarget build3 = new BuildTarget(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3"), "java_build_target_1", "kind");
            isValid = workspaceAPI.isValidTarget(build3);
            Assert.assertFalse(isValid);

            BuildTarget build4 = new BuildTarget(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3"), "java_build_target_2", "kind");
            isValid = workspaceAPI.isValidTarget(build4);
            Assert.assertFalse(isValid);

            BuildTarget build5 = new BuildTarget(Paths.get("//lib/lib"), "build", "kind");
            isValid = workspaceAPI.isValidTarget(build5);
            Assert.assertFalse(isValid);

            BuildTarget build6 = new BuildTarget(Paths.get("lib/lib"), "build", "kind");
            isValid = workspaceAPI.isValidTarget(build6);
            Assert.assertFalse(isValid);

            BuildTarget build7 = new BuildTarget(Paths.get("//lib"), null, "kind");
            isValid = workspaceAPI.isValidTarget(build7);
            Assert.assertFalse(isValid);

            BuildTarget build8 = new BuildTarget(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2"), "fake", "kind");
            isValid = workspaceAPI.isValidTarget(build8);
            Assert.assertFalse(isValid);

        } catch (Exception e) {
            Assert.fail();
        }
    }

    @Test
    public void validSources_should_returnTrue_With_longPackage() {
        try {
            boolean isValid;

            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);
            SourceFile main = new SourceFile("main.java", Paths.get("//main/main.java"));
            isValid = workspaceAPI.isSourceFileInPackage(main);
            Assert.assertTrue(isValid);

            SourceFile file2 = new SourceFile("file2.java", Paths.get("//main/file2.java"));
            isValid = workspaceAPI.isSourceFileInPackage(file2);
            Assert.assertTrue(isValid);

            SourceFile file3 = new SourceFile("file3.java", Paths.get("//main/file3.java"));
            isValid = workspaceAPI.isSourceFileInPackage(file3);
            Assert.assertTrue(isValid);

            SourceFile file4 = new SourceFile("file4.java", Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/file4.java"));
            isValid = workspaceAPI.isSourceFileInPackage(file4);
            Assert.assertTrue(isValid);

            SourceFile file5 = new SourceFile("file5.java", Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/file5.java"));
            isValid = workspaceAPI.isSourceFileInPackage(file5);
            Assert.assertTrue(isValid);

        } catch (Exception e) {
            Assert.fail();
        }
    }

    @Test
    public void invalidSources_should_returnFalse_With_longPackage() {
        try {
            boolean isValid;

            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);

            SourceFile fake1 = new SourceFile("fake.java", Paths.get("//main/fake.java"));
            isValid = workspaceAPI.isSourceFileInPackage(fake1);
            Assert.assertFalse(isValid);

            SourceFile fake2 = new SourceFile("main.", Paths.get("//main/fake."));
            isValid = workspaceAPI.isSourceFileInPackage(fake2);
            Assert.assertFalse(isValid);

            SourceFile fake3 = new SourceFile("fake", Paths.get("//main/fake"));
            isValid = workspaceAPI.isSourceFileInPackage(fake3);
            Assert.assertFalse(isValid);

            SourceFile fake4 = new SourceFile("", Paths.get("//main/"));
            isValid = workspaceAPI.isSourceFileInPackage(fake4);
            Assert.assertFalse(isValid);

            SourceFile fake5 = new SourceFile("", Paths.get("//"));
            isValid = workspaceAPI.isSourceFileInPackage(fake5);
            Assert.assertFalse(isValid);

            SourceFile fake6 = new SourceFile("", Paths.get(""));
            isValid = workspaceAPI.isSourceFileInPackage(fake6);
            Assert.assertFalse(isValid);

            SourceFile fake7 = new SourceFile("file1.java", Paths.get("//lib/file1.java"));
            isValid = workspaceAPI.isSourceFileInPackage(fake7);
            Assert.assertFalse(isValid);


        } catch (Exception e) {
            Assert.fail();
        }
    }


    public WorkspaceTree initializeSimpleWorkSpaceTree() {
        Package currentWorkspaceRoot = new Package("/");
        WorkspaceTree workspaceTreeInConstruction = new WorkspaceTree(currentWorkspaceRoot);

        workspaceTreeInConstruction.getRoot().addChild(package1);
        workspaceTreeInConstruction.getRoot().addChild(package2);
        workspaceTreeInConstruction.getRoot().getChild("lib").get().addChild(package3);
        workspaceTreeInConstruction.getRoot().getChild("lib").get().getChild("bazelLib").get().addChild(package4);
        workspaceTreeInConstruction.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .addChild(package5);
        workspaceTreeInConstruction.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .getChild("bazelLib2").get().addChild(package6);

        BuildTarget buildTargetP2_1 = new BuildTarget(package2Mock, "java_build_target", "kind");
        BuildTarget buildTargetP2_2 = new BuildTarget(package2Mock, "java_build_target_2", "kind");

        BuildTarget buildTargetP2_3 = new BuildTarget(package6Mock, "java_build_target_3", "kind");
        BuildTarget buildTargetP2_4 = new BuildTarget(package6Mock, "java_build_target_4", "kind");

        workspaceTreeInConstruction.getRoot().getChild("lib").get().getValue().addBuildTarget(buildTargetP2_1);
        workspaceTreeInConstruction.getRoot().getChild("lib").get().getValue().addBuildTarget(buildTargetP2_2);

        workspaceTreeInConstruction.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .getChild("bazelLib2").get().getChild("bazelLib3").get().getValue().addBuildTarget(buildTargetP2_3);

        workspaceTreeInConstruction.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .getChild("bazelLib2").get().getChild("bazelLib3").get().getValue().addBuildTarget(buildTargetP2_4);

        SourceFile sourceFile1 = new SourceFile("main.java", source1Mock);
        SourceFile sourceFile2 = new SourceFile("file2.java", source2Mock);
        SourceFile sourceFile3 = new SourceFile("file3.java", source3Mock);
        workspaceTreeInConstruction.getRoot().getChild("main").get().getValue().addSourceFile(sourceFile1);
        workspaceTreeInConstruction.getRoot().getChild("main").get().getValue().addSourceFile(sourceFile2);
        workspaceTreeInConstruction.getRoot().getChild("main").get().getValue().addSourceFile(sourceFile3);

        SourceFile sourceFile4 = new SourceFile("file4.java", source4Mock);
        SourceFile sourceFile5 = new SourceFile("file5.java", source5Mock);

        workspaceTreeInConstruction.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .getChild("bazelLib2").get().getChild("bazelLib3").get().getValue().addSourceFile(sourceFile4);

        workspaceTreeInConstruction.getRoot().getChild("lib").get().getChild("bazelLib").get().getChild("bazelLib1").get()
                .getChild("bazelLib2").get().getChild("bazelLib3").get().getValue().addSourceFile(sourceFile5);

        return workspaceTreeInConstruction;
    }

    @Test
    public void returnsBuildTargetCorrectly() {
        try {
            Path buildPath;
            WorkspaceAPI workspaceAPI = new WorkspaceAPI(simpleWorkSpaceTree);

            SourceFile main = new SourceFile("main.java", Paths.get("//main/main.java"));
            buildPath = workspaceAPI.findPathToBUILDFromSourceFile(main);
            Assert.assertEquals(Paths.get("//main/BUILD"), buildPath);

            SourceFile file2 = new SourceFile("file2.java", Paths.get("//main/file2.java"));
            buildPath = workspaceAPI.findPathToBUILDFromSourceFile(file2);
            Assert.assertEquals(Paths.get("//main/BUILD"), buildPath);

            SourceFile file3 = new SourceFile("file3.java", Paths.get("//main/file3.java"));
            buildPath = workspaceAPI.findPathToBUILDFromSourceFile(file3);
            Assert.assertEquals(Paths.get("//main/BUILD"), buildPath);

            SourceFile file4 = new SourceFile("file4.java", Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/file4.java"));
            buildPath = workspaceAPI.findPathToBUILDFromSourceFile(file4);
            Assert.assertEquals(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/BUILD"), buildPath);

            SourceFile file5 = new SourceFile("file5.java", Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/file5.java"));
            buildPath = workspaceAPI.findPathToBUILDFromSourceFile(file5);
            Assert.assertEquals(Paths.get("//lib/bazelLib/bazelLib1/bazelLib2/bazelLib3/BUILD"), buildPath);
        } catch (WorkspaceAPIException e) {
            Assert.fail();
        }
    }

    public WorkspaceTree initializeSimpleRemoteWorkSpaceTree() {
        Package remoteWorkspace2 = new Package("@remote2");
        WorkspaceTree treeInConstruction = new WorkspaceTree(remoteWorkspace2);
//
//        treeInConstruction.getRoot().addChild(package1);
//        treeInConstruction.getRoot().getChild("main").get().addChild(package3);
//        treeInConstruction.getRoot().getChild("main").get().addChild(package4);
//        treeInConstruction.getRoot().getChild("main").get().addChild(package5);
//
//        BuildTarget buildTargetP2_1 = new BuildTarget(package2Mock,"java_build_target", "java");
//        BuildTarget buildTargetP2_2 = new BuildTarget(package2Mock,"java_build_target_2", "java");
//
//        BuildTarget buildTargetP2_3 = new BuildTarget(package6Mock,"java_build_target_3", "java");
//        BuildTarget buildTargetP2_4 = new BuildTarget(package6Mock,"java_build_target_4", "java");
//
//        treeInConstruction.getRoot().getChild("main").get().getValue().addBuildTarget(buildTargetP2_1);
//        treeInConstruction.getRoot().getChild("main").get().getValue().addBuildTarget(buildTargetP2_2);
//        treeInConstruction.getRoot().getChild("main").get().getChild("bazelLib").get().getValue().addBuildTarget(buildTargetP2_3);
//        treeInConstruction.getRoot().getChild("lib").get().getChild("bazelLib").get().getValue().addBuildTarget(buildTargetP2_4);
//
//        SourceFile sourceFile1 = new SourceFile("main.java",source1Mock);
//        SourceFile sourceFile2 = new SourceFile("file2.java",source2Mock);
//        SourceFile sourceFile3 = new SourceFile("file3.java",source3Mock);
//        SourceFile sourceFile4 = new SourceFile("file4.java",source4Mock);
//        SourceFile sourceFile5 = new SourceFile("file5.java",source5Mock);
//
//        treeInConstruction.getRoot().getChild("main").get().getValue().addSourceFile(sourceFile1);
//        treeInConstruction.getRoot().getChild("main").get().getValue().addSourceFile(sourceFile2);
//        treeInConstruction.getRoot().getChild("main").get().getValue().addSourceFile(sourceFile3);
//        treeInConstruction.getRoot().getChild("main").get().getValue().addSourceFile(sourceFile4);
//        treeInConstruction.getRoot().getChild("main").get().getValue().addSourceFile(sourceFile5);

        return treeInConstruction;
    }
}