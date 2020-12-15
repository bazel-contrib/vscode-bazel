package server.services;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.DidChangeTextDocumentParams;
import org.eclipse.lsp4j.DidCloseTextDocumentParams;
import org.eclipse.lsp4j.DidOpenTextDocumentParams;
import org.eclipse.lsp4j.DidSaveTextDocumentParams;
import org.eclipse.lsp4j.services.TextDocumentService;

public class TextDocument implements TextDocumentService {
    private static final Logger logger = LogManager.getLogger(TextDocument.class);

    @Override
    public void didOpen(DidOpenTextDocumentParams params) {
        logger.info("Did open");
        logger.info(params.toString());
    }

    @Override
    public void didChange(DidChangeTextDocumentParams params) {
        logger.info("Did change");
        logger.info(params.toString());
    }

    @Override
    public void didClose(DidCloseTextDocumentParams params) {
        logger.info("Did close");
        logger.info(params.toString());
    }

    @Override
    public void didSave(DidSaveTextDocumentParams params) {
        logger.info("Did save");
        logger.info(params.toString());
    }

    // TODO:
    // - Create observer pattern, one observer per service
    // - Create generic observer collection
    // - Subscribe the indexer to the text document observer changes
    public interface IObserver extends TextDocumentService { }
}
