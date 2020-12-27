package server;

import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.jsonrpc.Launcher;
import org.eclipse.lsp4j.services.LanguageClient;
import org.eclipse.lsp4j.services.LanguageClientAware;
import org.eclipse.lsp4j.services.LanguageServer;
import org.eclipse.lsp4j.services.TextDocumentService;
import org.eclipse.lsp4j.services.WorkspaceService;

import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.concurrent.CompletableFuture;

public class BazelLanguageServer implements LanguageServer, LanguageClientAware {
    private static final int EXIT_SUCCESS = 0;

    public static void main(String[] args) {
        BazelLanguageServer server = new BazelLanguageServer();
        Launcher<LanguageClient> launcher = Launcher.createLauncher(server, LanguageClient.class, System.in, System.out);
        server.connect(launcher.getRemoteProxy());
        launcher.startListening();
    }

    private BazelServices bazelServices;

    public BazelLanguageServer() {
        bazelServices = new BazelServices();
    }

    @Override
    public CompletableFuture<InitializeResult> initialize(InitializeParams params) {
        String rootUriString = params.getRootUri();
        if (rootUriString != null) {
            URI uri = URI.create(params.getRootUri());
            Path workspaceRoot = Paths.get(uri);
            bazelServices.setWorkspaceRoot(workspaceRoot);
        }

        ServerCapabilities serverCapabilities = new ServerCapabilities();
        serverCapabilities.setTextDocumentSync(TextDocumentSyncKind.Full);

        InitializeResult initializeResult = new InitializeResult(serverCapabilities);
        return CompletableFuture.completedFuture(initializeResult);
    }

    @Override
    public CompletableFuture<Object> shutdown() {
        return CompletableFuture.completedFuture(new Object());
    }

    @Override
    public void exit() {
        System.exit(EXIT_SUCCESS);
    }

    @Override
    public TextDocumentService getTextDocumentService() {
        return bazelServices;
    }

    @Override
    public WorkspaceService getWorkspaceService() {
        return bazelServices;
    }

    @Override
    public void connect(LanguageClient client) {
        bazelServices.connect(client);
    }
}