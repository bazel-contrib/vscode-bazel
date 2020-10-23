package server;

import org.eclipse.lsp4j.DidChangeConfigurationParams;
import org.eclipse.lsp4j.DidChangeTextDocumentParams;
import org.eclipse.lsp4j.DidChangeWatchedFilesParams;
import org.eclipse.lsp4j.DidCloseTextDocumentParams;
import org.eclipse.lsp4j.DidOpenTextDocumentParams;
import org.eclipse.lsp4j.DidSaveTextDocumentParams;
import org.eclipse.lsp4j.services.LanguageClient;
import org.eclipse.lsp4j.services.LanguageClientAware;
import org.eclipse.lsp4j.services.TextDocumentService;
import org.eclipse.lsp4j.services.WorkspaceService;
import server.logger.BazelServerLogger;

import java.nio.file.Path;

public class BazelServices implements TextDocumentService, WorkspaceService, LanguageClientAware {
    private LanguageClient languageClient;
    private Path workspaceRoot;

    private BazelServerLogger logger = BazelServerLogger.getLogger();

    @Override
    public void didOpen(DidOpenTextDocumentParams params) {
        logger.log("Did Open");
        logger.log(params.toString());
    }

    @Override
    public void didChange(DidChangeTextDocumentParams params) {
        logger.log("Did Change");
        logger.log(params.toString());
    }

    @Override
    public void didClose(DidCloseTextDocumentParams params) {
        logger.log("Did Close");
        logger.log(params.toString());
    }

    @Override
    public void didSave(DidSaveTextDocumentParams params) {
        logger.log("Did Save");
        logger.log(params.toString());
    }

    @Override
    public void didChangeConfiguration(DidChangeConfigurationParams params) {
        logger.log("Did Change Configuration");
        logger.log(params.toString());
    }

    @Override
    public void didChangeWatchedFiles(DidChangeWatchedFilesParams params) {
        logger.log("Did Change Watched Files");
        logger.log(params.toString());
    }

    @Override
    public void connect(LanguageClient client) {
        languageClient = client;
    }

    public void setWorkspaceRoot(Path workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
}
