package server;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.jsonrpc.Launcher;
import org.eclipse.lsp4j.services.LanguageClient;
import org.eclipse.lsp4j.services.LanguageClientAware;
import org.eclipse.lsp4j.services.LanguageServer;
import org.eclipse.lsp4j.services.TextDocumentService;
import org.eclipse.lsp4j.services.WorkspaceService;
import server.workspace.ProjectFolder;
import server.workspace.Workspace;

import java.util.Arrays;
import java.util.concurrent.CompletableFuture;

public class BazelLanguageServer implements LanguageServer, LanguageClientAware {
    private static final int EXIT_SUCCESS = 0;
    private static final Logger logger = LogManager.getLogger(BazelLanguageServer.class);

    public static void main(String[] args) {
        final BazelLanguageServer server = new BazelLanguageServer();
        final Launcher<LanguageClient> launcher = Launcher.createLauncher(server, LanguageClient.class,
                System.in, System.out);

        logger.info("Launching server...");
        server.connect(launcher.getRemoteProxy());
        launcher.startListening();
    }

    private BazelServices bazelServices;

    public BazelLanguageServer() {
        bazelServices = new BazelServices();
    }

    @Override
    public CompletableFuture<InitializeResult> initialize(InitializeParams params) {
        logger.info(String.format("Starting up bazel language server with params: \"%s\"", params));

        // Initialize the workspace root folder.
        {
            final ProjectFolder folder = ProjectFolder.fromURI(params.getRootUri());
            Workspace.getInstance().setRootFolder(folder);

            logger.info(String.format("Declared root folder: \"%s\"", Workspace.getInstance().getRootFolder()));
        }

        // Specify capabilities for the server.
        ServerCapabilities serverCapabilities;
        {
            serverCapabilities = new ServerCapabilities();

            serverCapabilities.setTextDocumentSync(TextDocumentSyncKind.Full);

            final CompletionOptions completionOptions = new CompletionOptions(true, Arrays.asList(":", "/"));
            serverCapabilities.setCompletionProvider(completionOptions);

            logger.info(String.format("Declared server capabilities: \"%s\"", serverCapabilities));
        }

        final InitializeResult initializeResult = new InitializeResult(serverCapabilities);
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
