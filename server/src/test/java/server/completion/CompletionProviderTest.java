package server.completion;

import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import server.bazel.bazelWorkspaceAPI.WorkspaceAPI;
import server.bazel.tree.BuildTarget;
import server.bazel.tree.Package;
import server.bazel.tree.WorkspaceTree;
import server.utils.DocumentTracker;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class CompletionProviderTest {
    private CompletionProvider classUnderTest;
    private WorkspaceAPI api;
    private WorkspaceTree tree;
    private DocumentTracker tracker;

    @Before
    public void setUp() throws Exception {
        tree = new WorkspaceTree(new Package("/"));

        Package main = new Package("main");
        main.addBuildTarget(new BuildTarget(Path.of("/main"), "main_Target", "test"));

        Package lib = new Package("lib");
        lib.addBuildTarget(new BuildTarget(Path.of("/lib"), "lib_Target", "test"));

        Package main_1 = new Package("main_1");
        main_1.addBuildTarget(new BuildTarget(Path.of("/main/main_1"), "main_1_Target", "test"));

        Package main_2 = new Package("main_2");
        main_2.addBuildTarget(new BuildTarget(Path.of("/main/main_2"), "main_2_Target", "test"));

        Package lib_1 = new Package("lib_1");
        lib_1.addBuildTarget(new BuildTarget(Path.of("/lib/lib_1"), "lib_1_Target", "test"));

        Package lib_2 = new Package("lib_2");
        lib_2.addBuildTarget(new BuildTarget(Path.of("/lib/lib_2"), "lib_2_Target", "test"));

        WorkspaceTree.Node node = tree.getRoot().addChild(main);
        node.addChild(main_1);
        node.addChild(main_2);

        node = tree.getRoot().addChild(lib);
        node.addChild(lib_1);
        node.addChild(lib_2);


        api = new WorkspaceAPI(tree);
        classUnderTest = Mockito.spy(CompletionProvider.getInstance());
        tracker = Mockito.spy(DocumentTracker.getInstance());
        Mockito.doReturn(api).when(classUnderTest).getWorkspaceAPI();
        Mockito.doReturn(tracker).when(classUnderTest).getDocumentTracker();
        Mockito.doReturn(
                "load(\"@rules_java//java:defs.bzl\", \"java_library\")\n" +
                        "\n" +
                        "package(default_visibility = [\"//visibility:public\"])\n" +
                        "\n" +
                        "java_library(\n" +
                        "    name = \"completion\",\n" +
                        "    srcs = [\n" +
                        "        \"CompletionProviderTest.java\",\n" +
                        "    ],\n" +
                        "    deps = [\n" +
                        "        \"/\",\n" +
                        "        \"//server/src/main/java/server/bazel/bazelWorkspaceAPI\",\n" +
                        "        \"//server/src/main/java/server/bazel/tree\",\n" +
                        "        \"//server/src/main/java/server/completion\",\n" +
                        "        \"//server/src/main/java/server/utils\",\n" +
                        "        \"//server/src/main/java/server/workspace\",\n" +
                        "        \"//third_party/java:gson\",\n" +
                        "        \"//third_party/java:guava\",\n" +
                        "        \"//third_party/java:jmifs\",\n" +
                        "        \"//third_party/java:junit\",\n" +
                        "        \"//third_party/java:log4j\",\n" +
                        "        \"//third_party/java:lsp4j\",\n" +
                        "        \"//third_party/java:mockito\",\n" +
                        "        \"//third_party/java:powermock\",\n" +
                        "        \"//third_party/java:powermock-junit\",\n" +
                        "        \"//third_party/java:powermock-mockito\",\n" +
                        "        \"/\"\n" +
                        "    ],\n" +
                        ")\n").when(tracker).getContents(Mockito.any());
    }

    @After
    public void tearDown() {
        classUnderTest = null;
        api = null;
        tree = null;
    }

    @Test
    public void getRootFolderCompletion() throws Exception {
        CompletionParams params = new CompletionParams(new TextDocumentIdentifier("somedocument"), new Position(26,10), new CompletionContext(CompletionTriggerKind.TriggerCharacter, "/"));
        CompletableFuture<Either<List<CompletionItem>, CompletionList>> future = classUnderTest.getCompletion(params);
        CompletionList list = (CompletionList)future.get().get();
        Assert.assertEquals(2, list.getItems().size());
        Assert.assertTrue(listContainsValue(list.getItems(), "/main"));
        Assert.assertTrue(listContainsValue(list.getItems(), "/lib"));
    }

    private boolean listContainsValue(List<CompletionItem> items, String value) {
        for(CompletionItem item : items) {
            if(item.getInsertText().equals(value)) {
                return true;
            }
        }
        return false;
    }
}