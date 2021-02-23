package server.completion;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.CompletionItem;
import org.eclipse.lsp4j.CompletionItemKind;
import org.eclipse.lsp4j.CompletionList;
import org.eclipse.lsp4j.CompletionParams;
import org.eclipse.lsp4j.Position;
import org.eclipse.lsp4j.Range;
import org.eclipse.lsp4j.TextEdit;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import server.bazel.bazelWorkspaceAPI.WorkspaceAPI;
import server.bazel.bazelWorkspaceAPI.WorkspaceAPIException;
import server.bazel.tree.BuildTarget;
import server.utils.DocumentTracker;

import server.utils.Logging;
import server.workspace.Workspace;

public class CompletionProvider {
    private static final Logger logger = LogManager.getLogger(CompletionProvider.class);

    /**
     * This method takes the completionParams and determines enough context to give a list of
     * potential completionItems. These items will appear as autocomplete options for the user.
     *
     * @param workspaceRoot    The path from the workspace root to the current file.
     * @param completionParams A object containing a TextDocumentIdentifier,
     *                         Position, and CompletionContext
     * @return A list of CompletionItems that can be used for autocomplete options for the user.
     */
    public static CompletableFuture<Either<List<CompletionItem>, CompletionList>> getCompletion(
            Path workspaceRoot, CompletionParams completionParams) {

        logger.info("Workspace Path: {}", workspaceRoot.toString());
        List<CompletionItem> completionItems = new ArrayList<>();
        try {
            logger.info("URI: {}", completionParams.getTextDocument().getUri().substring(7));
            List<String> lines = Arrays.asList(DocumentTracker.getInstance().getContents(URI.create(completionParams.getTextDocument().getUri())).split("\n"));
            String line = lines.get(completionParams.getPosition().getLine());

            logger.info("Working line: {}", line);
            logger.info("Trigger Character: {}", completionParams.getContext().getTriggerCharacter());
            String triggerCharacter = completionParams.getContext().getTriggerCharacter();
            if (triggerCharacter.equals("/")) {
                getPathItems(line, workspaceRoot, completionParams, completionItems);
            } else if (triggerCharacter.equals(":")) {
                getBuildTargets(line, workspaceRoot, completionParams, completionItems);
            }

        } catch (IOException e) {
            logger.error("Hit exception");
            logger.error(Logging.stackTraceToString(e));
        } catch (Exception e) {
            // TODO: Find the cause of the completion null pointer exception and error check accordingly
            logger.error("Hit the catch for generic exceptions");
            logger.error(Logging.stackTraceToString(e));
        }

        logger.info(completionItems);
        return CompletableFuture.completedFuture(Either.forRight(new CompletionList(completionItems)));

    }

    private static void getBuildTargets(String line, Path workspaceRoot, CompletionParams completionParams, List<CompletionItem> completionItems) throws WorkspaceAPIException {
        String newPath = getPath(line, completionParams.getPosition());
        newPath = newPath.substring(0, newPath.length() - 1);
        logger.info("New path: {}", newPath);
        WorkspaceAPI workspaceAPI = new WorkspaceAPI(Workspace.getInstance().getWorkspaceTree());
        List<BuildTarget> paths = workspaceAPI.findPossibleTargetsForPath(Path.of(newPath));
        paths.parallelStream().forEach(item -> {
            CompletionItem completionItem = new CompletionItem(item.getLabel());
            completionItem.setKind(CompletionItemKind.Value);
            completionItem.setInsertText(item.getLabel());
            completionItem.setTextEdit(new TextEdit(new Range(completionParams.getPosition(), new Position(completionParams.getPosition().getLine(), completionParams.getPosition().getCharacter())), item.getLabel()));
            logger.info("Added item: {}", completionItem);
            completionItems.add(completionItem);
        });
    }

    private static void getPathItems(String line, Path workspaceRoot, CompletionParams completionParams, List<CompletionItem> completionItems) throws IOException, WorkspaceAPIException {
        String newPath = getPath(line, completionParams.getPosition());
        logger.info("New path: {}", newPath);
        WorkspaceAPI workspaceAPI = new WorkspaceAPI(Workspace.getInstance().getWorkspaceTree());
        List<Path> paths = workspaceAPI.findPossibleCompletionsForPath(Path.of(newPath));
        paths.parallelStream().forEach(item -> {
            CompletionItem completionItem = new CompletionItem(item.toString());
            completionItem.setKind(CompletionItemKind.Folder);
            completionItem.setInsertText(item.toString());
            completionItem.setTextEdit(new TextEdit(new Range(completionParams.getPosition(), new Position(completionParams.getPosition().getLine(), completionParams.getPosition().getCharacter())), item.toString()));
            logger.info("Added item: {}", completionItem);
            completionItems.add(completionItem);
        });
    }

    private static String getPath(String line, Position position) {
        StringBuilder path = new StringBuilder();
        int index = position.getCharacter() - 1;
        while (index >= 0 && line.charAt(index) != '"') { // Build string from back to front
            path.append(line.charAt(index));
            index--;
        }
        return path.reverse().toString();
    }

}
