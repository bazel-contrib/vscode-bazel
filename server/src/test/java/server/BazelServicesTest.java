package server;

import org.eclipse.lsp4j.DidChangeTextDocumentParams;
import org.eclipse.lsp4j.DidCloseTextDocumentParams;
import org.eclipse.lsp4j.DidOpenTextDocumentParams;
import org.eclipse.lsp4j.DidSaveTextDocumentParams;
import org.eclipse.lsp4j.MessageActionItem;
import org.eclipse.lsp4j.MessageParams;
import org.eclipse.lsp4j.PublishDiagnosticsParams;
import org.eclipse.lsp4j.ShowMessageRequestParams;
import org.eclipse.lsp4j.TextDocumentItem;
import org.eclipse.lsp4j.services.LanguageClient;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.Mockito;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.CompletableFuture;

class BazelServicesTest {
    private static final String LANGUAGE_BAZEL = "bazel";
    private static final String PATH_WORKSPACE = "./build/test_workspace/";
    private static final String PATH_SRC = "./src/main/bazel";

    private BazelServices services;
    private Path workspaceRoot;
    private Path srcRoot;

    @BeforeEach
    void setup() {
        workspaceRoot = Paths.get(System.getProperty("user.dir")).resolve(PATH_WORKSPACE);
        srcRoot = workspaceRoot.resolve(PATH_SRC);
        if(!Files.exists(srcRoot)) {
            srcRoot.toFile().mkdirs();
        }

        services = Mockito.spy(new BazelServices());
        services.setWorkspaceRoot(workspaceRoot);
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

    @Test
    void didOpen() throws Exception {
        services.didOpen(new DidOpenTextDocumentParams());
        Mockito.verify(services).didOpen(new DidOpenTextDocumentParams());
    }

    @AfterEach
    void tearDown() {
        services = null;
        workspaceRoot = null;
        srcRoot = null;
    }

    @Test
    void didChange() {
        services.didChange(new DidChangeTextDocumentParams());
        Mockito.verify(services).didChange(new DidChangeTextDocumentParams());
    }

    @Test
    void didClose() {
        services.didClose(new DidCloseTextDocumentParams());
        Mockito.verify(services).didClose(new DidCloseTextDocumentParams());
    }

    @Test
    void didSave() {
        services.didSave(new DidSaveTextDocumentParams());
        Mockito.verify(services).didSave(new DidSaveTextDocumentParams());
    }
}