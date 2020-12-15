package server.services;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.DidChangeConfigurationParams;
import org.eclipse.lsp4j.DidChangeWatchedFilesParams;
import org.eclipse.lsp4j.services.WorkspaceService;

public class Workspace implements WorkspaceService {
    private static final Logger logger = LogManager.getLogger(Workspace.class);

    @Override
    public void didChangeConfiguration(DidChangeConfigurationParams params) {
        logger.info("Did change configuration");
        logger.info(params.toString());
    }

    @Override
    public void didChangeWatchedFiles(DidChangeWatchedFilesParams params) {
        logger.info("Did change watched files");
        logger.info(params.toString());
    }
}
