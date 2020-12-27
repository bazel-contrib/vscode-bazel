package server;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
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

import server.utils.DocumentTracker;

import java.nio.file.Path;

public class BazelServices implements TextDocumentService, WorkspaceService, LanguageClientAware {
    private LanguageClient languageClient;
    private Path workspaceRoot;

    private DocumentTracker documentTracker = new DocumentTracker();

    private static final Logger logger = LogManager.getLogger(BazelServices.class);

    @Override
    public void didOpen(DidOpenTextDocumentParams params) {
        logger.info("Did Open");
        logger.info(params.toString());
        documentTracker.didOpen(params);
    }

    @Override
    public void didChange(DidChangeTextDocumentParams params) {
        logger.info("Did Change");
        logger.info(params.toString());
        documentTracker.didChange(params);
    }

    @Override
    public void didClose(DidCloseTextDocumentParams params) {
        logger.info("Did Close");
        logger.info(params.toString());
        documentTracker.didClose(params);
    }

    @Override
    public void didSave(DidSaveTextDocumentParams params) {
        logger.info("Did Save");
        logger.info(params.toString());
    }

    @Override
    public void didChangeConfiguration(DidChangeConfigurationParams params) {
        logger.info("Did Change Configuration");
        logger.info(params.toString());
    }

    @Override
    public void didChangeWatchedFiles(DidChangeWatchedFilesParams params) {
        logger.info("Did Change Watched Files");
        logger.info(params.toString());
    }

    @Override
    public void connect(LanguageClient client) {
        languageClient = client;
    }

    public void setWorkspaceRoot(Path workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
}