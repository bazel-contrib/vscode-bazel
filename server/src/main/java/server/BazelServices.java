package server;

import com.google.gson.Gson;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import org.eclipse.lsp4j.services.LanguageClient;
import org.eclipse.lsp4j.services.LanguageClientAware;
import org.eclipse.lsp4j.services.TextDocumentService;
import org.eclipse.lsp4j.services.WorkspaceService;

import server.completion.CompletionProvider;
import server.utils.DocumentTracker;
import server.workspace.ExtensionConfig;
import server.workspace.ProjectFolder;
import server.workspace.Workspace;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

public class BazelServices implements TextDocumentService, WorkspaceService, LanguageClientAware {
    private static final Logger logger = LogManager.getLogger(BazelServices.class);

    public static DocumentTracker getDocumentTracker() {
        return documentTracker;
    }

    private static final DocumentTracker documentTracker = new DocumentTracker();
    private LanguageClient languageClient;

    @Override
    public void didOpen(DidOpenTextDocumentParams params) {
        logger.info("Did Open");
        logger.info(params.toString());
        documentTracker.didOpen(params);
//        documentTracker.didOpen(params);

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

        {
//        PublishDiagnosticsParams diagnostics = new PublishDiagnosticsParams();
//        diagnostics.setUri(params.getTextDocument().getUri());

//        Diagnostic diagnostic = new Diagnostic();
//        diagnostic.setMessage("This is a test");
//        diagnostic.setSource(params.getTextDocument().getUri());
//        diagnostic.setCode(123);
//        diagnostic.setRange(new Range(new Position(0, 0)));
//        logger.info("Set severity");
//        diagnostic.setSeverity(DiagnosticSeverity.Error);
//        diagnostics.setDiagnostics(Lists.newArrayList(diagnostic));
//
//        logger.info("Publish Diagnostics");
//        languageClient.publishDiagnostics(diagnostics);
        }

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

//        try {
//            Analyzer.getInstance().analyze();
//        } catch (AnalysisException e) {
//            logger.info("Unable to analayze project", e);
//        }
    }

    @Override
    public void didClose(DidCloseTextDocumentParams params) {
        logger.info("Did Close");
        logger.info(params.toString());
        documentTracker.didClose(params);

//        final Buildifier buildifier = new Buildifier();
//        logger.info("BUILDIFIER EXISTS=" + buildifier.exists());
//
//        logger.info("ABOUT TO FORMAT A DOCUMENT!!!!!!");
//        try {
//            final URI uri = URI.create(params.getTextDocument().getUri());
//            final String content = new String(Files.readAllBytes(Paths.get(uri)));
//
//            final BuildifierFormatArgs args = new BuildifierFormatArgs();
//            {
//                args.setContent(content);
//                args.setShouldApplyLintFixes(true);
//                args.setType(BuildifierFileType.BUILD);
//            }
//
//            logger.info("FORMATTING NOW");
//            final String formattedContent = buildifier.format(args);
//            logger.info("FORMAT DONE=" + formattedContent);
//        } catch (BuildifierException e) {
//            logger.info("BUILDIFER FAILED :( ... error=" + e.getClass());
//        } catch (Exception e) {
//            logger.error("FORMATTING FAILED FOR SOME RANDOM REASON...", e);
//        }
//
//        logger.info("Finished buildifier thing");
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

        // Update extension configuration.
        {
            final Gson gson = new Gson();
            final String json = gson.toJson(params.getSettings());
            final ExtensionConfig config = gson.fromJson(json, ExtensionConfig.class);
            Workspace.getInstance().setExtensionConfig(config);
        }
    }

    @Override
    public void didChangeWatchedFiles(DidChangeWatchedFilesParams params) {
        logger.info("Did Change Watched Files");
        logger.info(params.toString());
    }

    @Override
    public void didChangeWorkspaceFolders(DidChangeWorkspaceFoldersParams params) {
        logger.info("Did Change Workspace Folders");
        logger.info(params.toString());

        // Update workspace folders.
        {
            final Collection<ProjectFolder> foldersToAdd = params.getEvent().getAdded().stream()
                    .map(e -> ProjectFolder.fromURI(e.getUri()))
                    .collect(Collectors.toList());

            final Collection<ProjectFolder> foldersToRemove = params.getEvent().getRemoved().stream()
                    .map(e -> ProjectFolder.fromURI(e.getUri()))
                    .collect(Collectors.toList());

            Workspace.getInstance().removeWorkspaceFolders(foldersToRemove);
            Workspace.getInstance().addWorkspaceFolders(foldersToAdd);
        }
    }

    @Override
    public void connect(LanguageClient client) {
        languageClient = client;
    }

    private List<CompletionItem> completionItems = new ArrayList<>();

    @Override
    public CompletableFuture<Either<List<CompletionItem>, CompletionList>> completion(CompletionParams completionParams) {
//        String item = "THIS IS MY FAKE ITEM 2";
//
//        CompletionItem completionItem = new CompletionItem(item);
//        completionItem.setKind(CompletionItemKind.Folder);
//        completionItem.setInsertText(item);
//        completionItem.setTextEdit(new TextEdit(new Range(completionParams.getPosition(), new Position(completionParams.getPosition().getLine(), completionParams.getPosition().getCharacter() + item.length())), item));
//        logger.info("Added item: " + completionItem);
//        completionItems.add(completionItem);
//
//        return CompletableFuture.completedFuture(Either.forRight(new CompletionList(completionItems)));
        return CompletionProvider.getCompletion(Workspace.getInstance().getRootFolder().getPath(), completionParams);
    }

    @Override
    public CompletableFuture<CompletionItem> resolveCompletionItem(CompletionItem unresolved) {
        return CompletableFuture.completedFuture(unresolved);
    }
}