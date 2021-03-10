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
import java.nio.file.Paths;
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
        main.addBuildTarget(new BuildTarget(Paths.get("/main"), "main_Target", "test"));

        Package lib = new Package("lib");
        lib.addBuildTarget(new BuildTarget(Paths.get("/lib"), "lib_Target", "test"));

        Package main_1 = new Package("main_1");
        main_1.addBuildTarget(new BuildTarget(Paths.get("/main/main_1"), "main_1_Target", "test"));
        main_1.addBuildTarget(new BuildTarget(Paths.get("/main/main_1"), "main_1_1_Target", "test"));

        Package main_2 = new Package("main_2");
        main_2.addBuildTarget(new BuildTarget(Paths.get("/main/main_2"), "main_2_Target", "test"));

        Package lib_1 = new Package("lib_1");
        lib_1.addBuildTarget(new BuildTarget(Paths.get("/lib/lib_1"), "lib_1_Target", "test"));

        Package lib_2 = new Package("lib_2");
        lib_2.addBuildTarget(new BuildTarget(Paths.get("/lib/lib_2"), "lib_2_Target", "test"));

        WorkspaceTree.Node node = tree.getRoot().addChild(main);
        node.addChild(main_1);
        node.addChild(main_2);

        node = tree.getRoot().addChild(lib);
        node.addChild(lib_1);
        node.addChild(lib_2);


        api = new WorkspaceAPI(tree);
        classUnderTest = Mockito.spy(new CompletionProvider());
        tracker = Mockito.spy(DocumentTracker.getInstance());
        Mockito.doReturn(api).when(classUnderTest).getWorkspaceAPI();
        Mockito.doReturn(tracker).when(classUnderTest).getDocumentTracker();
    }

    @After
    public void tearDown() {
        classUnderTest = null;
        api = null;
        tree = null;
    }

    @Test
    public void getRootFolderCompletion() throws Exception {
        Mockito.doReturn("\"//\"\n").when(tracker).getContents(Mockito.any());
        CompletionParams params = new CompletionParams(new TextDocumentIdentifier("somedocument"), new Position(0,3), new CompletionContext(CompletionTriggerKind.TriggerCharacter, "/"));
        CompletableFuture<Either<List<CompletionItem>, CompletionList>> future = classUnderTest.getCompletion(params);
        CompletionList list = (CompletionList)future.get().get();
        Assert.assertEquals(2, list.getItems().size());
        Assert.assertTrue(listContainsValue(list.getItems(), "main"));
        Assert.assertTrue(listContainsValue(list.getItems(), "lib"));
    }

    @Test
    public void getPathFolderCompletion() throws Exception {
        Mockito.doReturn("\"//main/\"\n").when(tracker).getContents(Mockito.any());
        CompletionParams params = new CompletionParams(new TextDocumentIdentifier("somedocument"), new Position(0,8), new CompletionContext(CompletionTriggerKind.TriggerCharacter, "/"));
        CompletableFuture<Either<List<CompletionItem>, CompletionList>> future = classUnderTest.getCompletion(params);
        CompletionList list = (CompletionList)future.get().get();
        Assert.assertEquals(2, list.getItems().size());
        Assert.assertTrue(listContainsValue(list.getItems(), "main_1"));
        Assert.assertTrue(listContainsValue(list.getItems(), "main_2"));
    }

    @Test
    public void getRootTargetCompletion() throws Exception {
        Mockito.doReturn("\"//main:\"\n").when(tracker).getContents(Mockito.any());
        CompletionParams params = new CompletionParams(new TextDocumentIdentifier("somedocument"), new Position(0,8), new CompletionContext(CompletionTriggerKind.TriggerCharacter, ":"));
        CompletableFuture<Either<List<CompletionItem>, CompletionList>> future = classUnderTest.getCompletion(params);
        CompletionList list = (CompletionList)future.get().get();
        Assert.assertEquals(1, list.getItems().size());
        Assert.assertTrue(listContainsValue(list.getItems(), "main_Target"));
    }

    @Test
    public void getPathTargetCompletion() throws Exception {
        Mockito.doReturn("\"//main/main_1:\"\n").when(tracker).getContents(Mockito.any());
        CompletionParams params = new CompletionParams(new TextDocumentIdentifier("somedocument"), new Position(0,15), new CompletionContext(CompletionTriggerKind.TriggerCharacter, ":"));
        CompletableFuture<Either<List<CompletionItem>, CompletionList>> future = classUnderTest.getCompletion(params);
        CompletionList list = (CompletionList)future.get().get();
        Assert.assertEquals(2, list.getItems().size());
        Assert.assertTrue(listContainsValue(list.getItems(), "main_1_Target"));
        Assert.assertTrue(listContainsValue(list.getItems(), "main_1_1_Target"));
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