package server;

import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.services.LanguageClient;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Collections;
import java.util.concurrent.CompletableFuture;

public class BazelServicesTest {
    private static final String LANGUAGE_BAZEL = "bazel";
    private static final String PATH_WORKSPACE = "./build/test_workspace/";
    private static final String PATH_SRC = "./src/main/bazel";

    private BazelServices services;
    private Path workspaceRoot;
    private Path srcRoot;

    @Before
    public void setup() {
        workspaceRoot = Paths.get(System.getProperty("user.dir")).resolve(PATH_WORKSPACE);
        srcRoot = workspaceRoot.resolve(PATH_SRC);
        if(!Files.exists(srcRoot)) {
            srcRoot.toFile().mkdirs();
        }

        services = Mockito.spy(new BazelServices());
        services.connect(new LanguageClient() {
            @Override
            public void telemetryEvent(Object object) {

            }

            @Override
            public void publishDiagnostics(PublishDiagnosticsParams diagnostics) {

            }

            @Override
            public void showMessage(MessageParams messageParams) {

            }

            @Override
            public CompletableFuture<MessageActionItem> showMessageRequest(ShowMessageRequestParams requestParams) {
                return null;
            }

            @Override
            public void logMessage(MessageParams message) {

            }
        });
    }

    @After
    public void tearDown() {
        services = null;
        workspaceRoot = null;
        srcRoot = null;
    }

    @Test
    public void didOpen() throws Exception {
        DidOpenTextDocumentParams params = new DidOpenTextDocumentParams();
        params.setTextDocument(new TextDocumentItem("test.txt", "plaintext", 1, "arbitrary value"));

        services.didOpen(params);
        Mockito.verify(services).didOpen(params);
    }

    @Test
    public void didChange() {
        DidOpenTextDocumentParams params = new DidOpenTextDocumentParams();
        params.setTextDocument(new TextDocumentItem("test.txt", "plaintext", 1, "arbitrary value"));
        services.didOpen(params);

        DidChangeTextDocumentParams changeParams = new DidChangeTextDocumentParams();
        changeParams.setTextDocument(new VersionedTextDocumentIdentifier("/test.txt", 2));

        TextDocumentContentChangeEvent changeEvent = new TextDocumentContentChangeEvent();
        changeEvent.setText(" data");
        changeEvent.setRange(new Range(new Position(0,9), new Position(0, 15)));
        changeParams.setContentChanges(Collections.singletonList(changeEvent));

        services.didChange(changeParams);
        Mockito.verify(services).didChange(changeParams);
    }

    @Test
    public void didClose() {
        DidCloseTextDocumentParams params = new DidCloseTextDocumentParams();
        params.setTextDocument(new TextDocumentIdentifier("test.txt"));

        services.didClose(params);
        Mockito.verify(services).didClose(params);
    }

    @Test
    public void didSave() {
        services.didSave(new DidSaveTextDocumentParams());
        Mockito.verify(services).didSave(new DidSaveTextDocumentParams());
    }
}