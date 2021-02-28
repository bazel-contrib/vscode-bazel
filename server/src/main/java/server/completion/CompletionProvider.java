package server.completion;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.*;
import org.eclipse.lsp4j.jsonrpc.messages.Either;
import server.bazel.bazelWorkspaceAPI.WorkspaceAPI;
import server.bazel.bazelWorkspaceAPI.WorkspaceAPIException;
import server.bazel.tree.BuildTarget;
import server.utils.DocumentTracker;
import server.utils.Logging;
import server.workspace.Workspace;

import java.net.URI;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;

public class CompletionProvider {
    private static final Logger logger = LogManager.getLogger(CompletionProvider.class);

    public CompletionProvider() {}

    private static String getPath(String line, Position position) {
        StringBuilder path = new StringBuilder();
        int index = position.getCharacter() - 1;
        while (index >= 0 && line.charAt(index) != '"') { // Build string from back to front
            path.append(line.charAt(index));
            index--;
        }
        return path.reverse().toString();
    }

    /**
     * This method takes the completionParams and determines enough context to give a list of
     * potential completionItems. These items will appear as autocomplete options for the user.
     *
     * @param completionParams A object containing a TextDocumentIdentifier,
     *                         Position, and CompletionContext
     * @return A list of CompletionItems that can be used for autocomplete options for the user.
     */
    public CompletableFuture<Either<List<CompletionItem>, CompletionList>> getCompletion(
            CompletionParams completionParams) {

        List<CompletionItem> completionItems = new ArrayList<>();
        try {
            List<String> lines = Arrays.asList(getDocumentTracker().getContents(URI.create(completionParams.getTextDocument().getUri())).split("\n"));
            String line = lines.get(completionParams.getPosition().getLine());

            String triggerCharacter = completionParams.getContext().getTriggerCharacter();
            Character characterBefore = line.charAt(completionParams.getPosition().getCharacter() - 2);
            if (triggerCharacter.equals("/")) {
                if(characterBefore.equals('/') || Character.isLetterOrDigit(characterBefore)) {
                    getPathItems(line, completionParams, completionItems);
                }
            } else if (triggerCharacter.equals(":")) {
                getBuildTargets(line, completionParams, completionItems);
            }

        } catch (Exception e) {
            logger.error(Logging.stackTraceToString(e));
        }// TODO: Find the cause of the completion null pointer exception and error check accordingly

        return CompletableFuture.completedFuture(Either.forRight(new CompletionList(completionItems)));

    }

    public DocumentTracker getDocumentTracker() {
        return DocumentTracker.getInstance();
    }

    private void getBuildTargets(String line, CompletionParams completionParams, List<CompletionItem> completionItems) throws WorkspaceAPIException {
        String newPath = getPath(line, completionParams.getPosition());
        newPath = newPath.substring(0, newPath.length() - 1);
        WorkspaceAPI workspaceAPI = getWorkspaceAPI();
        List<BuildTarget> paths = workspaceAPI.findPossibleTargetsForPath(Path.of(newPath));
        paths.parallelStream().forEach(item -> {
            CompletionItem completionItem = new CompletionItem(item.getLabel());
            completionItem.setKind(CompletionItemKind.Value);
            completionItem.setInsertText(item.getLabel());
            completionItem.setTextEdit(new TextEdit(new Range(completionParams.getPosition(), new Position(completionParams.getPosition().getLine(), completionParams.getPosition().getCharacter())), item.getLabel()));
            completionItems.add(completionItem);
        });
    }

    private void getPathItems(String line, CompletionParams completionParams, List<CompletionItem> completionItems) throws WorkspaceAPIException {
        String newPath = getPath(line, completionParams.getPosition());
        WorkspaceAPI workspaceAPI = getWorkspaceAPI();
        List<Path> paths = workspaceAPI.findPossibleCompletionsForPath(Path.of(newPath));
        paths.parallelStream().forEach(item -> {
            CompletionItem completionItem = new CompletionItem(item.toString());
            completionItem.setKind(CompletionItemKind.Folder);
            completionItem.setInsertText(item.toString());
            completionItem.setTextEdit(new TextEdit(new Range(completionParams.getPosition(), new Position(completionParams.getPosition().getLine(), completionParams.getPosition().getCharacter())), item.toString()));
            completionItems.add(completionItem);
        });
    }

    public WorkspaceAPI getWorkspaceAPI() throws WorkspaceAPIException {
        return new WorkspaceAPI(Workspace.getInstance().getWorkspaceTree());
    }

}
