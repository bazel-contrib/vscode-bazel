package server;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.services.LanguageClient;
import org.eclipse.lsp4j.services.LanguageClientAware;
import org.eclipse.lsp4j.services.TextDocumentService;
import org.eclipse.lsp4j.services.WorkspaceService;

import server.utils.DocumentTracker;
import server.workspace.Workspace;

public class BazelServices implements TextDocumentService, WorkspaceService, LanguageClientAware {
    private static final Logger logger = LogManager.getLogger(BazelServices.class);

    private final DocumentTracker documentTracker = new DocumentTracker();
    private LanguageClient languageClient;

    @Override
    public void didOpen(DidOpenTextDocumentParams params) {
        logger.info("Did Open");
        logger.info(params.toString());
        documentTracker.didOpen(params);

//        try {
//            ConfigurationParams p = new ConfigurationParams();
//            List<ConfigurationItem> configItems = new ArrayList<>();
//
//            ConfigurationItem item = new ConfigurationItem();
//            item.setSection("Bazel");
//            item.setScopeUri("bazel.java.home");
//            configItems.add(item);
//
//            p.setItems(configItems);
//
//            CompletableFuture<List<Object>> fut = languageClient.configuration(p);
//            List<Object> configObjs = fut.get(5000, TimeUnit.MILLISECONDS);
//            for (Object obj : configObjs) {
//                logger.info(obj);
//            }
//        } catch(Exception e) {
//            logger.error(e);
//        }
    }

    @Override
    public void didChange(DidChangeTextDocumentParams params) {
        logger.info("Did Change");
        logger.info(params.toString());
        documentTracker.didChange(params);
//        URI uri = URI.create(params.getTextDocument().getUri());
//        File file = new File(uri);
//
//        try {
//            logger.info(String.format("Attempting to parse file: %s", file.getAbsolutePath()));
//            ParseInput input = ParseInput.fromFile(file);
//            logger.info(String.format("Obtained parse input. Content=[\"%s\"], Loc=[\"%s\"]",
//                    new String(input.getBytes()), input.getPath()));
//
//            ParseOutput output = StarlarkFacade.parse(input);
//            logger.info("Parsed a Starlark file!");
//        } catch (IOException e) {
//            logger.error(e);
//        } catch (ParseException e) {
//            logger.info(String.format("Caused a %s exception!", e.getClass().getName()));
//        }
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
        Workspace.getInstance().processConfigurationChange(params);
    }

    @Override
    public void didChangeWatchedFiles(DidChangeWatchedFilesParams params) {
        logger.info("Did Change Watched Files");
        logger.info(params.toString());
        Workspace.getInstance().processWatchedFilesChange(params);
    }

    @Override
    public void didChangeWorkspaceFolders(DidChangeWorkspaceFoldersParams params) {
        logger.info("Did Change Workspace Folders");
        logger.info(params.toString());
        Workspace.getInstance().processWorkspaceFoldersChange(params);
    }

    @Override
    public void connect(LanguageClient client) {
        languageClient = client;
    }
}