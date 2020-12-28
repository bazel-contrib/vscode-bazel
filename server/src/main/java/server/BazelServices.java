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

import server.starlark.ParseException;
import server.starlark.ParseInput;
import server.starlark.ParseOutput;
import server.utils.DocumentTracker;
import server.starlark.StarlarkFacade;

import java.io.File;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
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
        URI uri = URI.create(params.getTextDocument().getUri());
        File file = new File(uri);

        try {
            logger.info(String.format("Attempting to parse file: %s", file.getAbsolutePath()));
            ParseInput input = ParseInput.fromFile(file);
            logger.info(String.format("Obtained parse input. Content=[\"%s\"], Loc=[\"%s\"]",
                    new String(input.getBytes()), input.getPath()));

            ParseOutput output = StarlarkFacade.parse(input);
            logger.info("Parsed a Starlark file!");
        } catch (IOException e) {
            logger.error(e);
        } catch (ParseException e) {
            logger.info(String.format("Caused a %s exception!", e.getClass().getName()));
        }
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