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
import server.utils.DocumentTracker;

import server.utils.Logging;

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

        logger.info("Workspace Path: " + workspaceRoot.toString());
        List<CompletionItem> completionItems = new ArrayList<>();
        try {
            logger.info("URI: " + completionParams.getTextDocument().getUri().substring(7));
            List<String> lines = Arrays.asList(DocumentTracker.getInstance().getContents(URI.create(completionParams.getTextDocument().getUri())).split("\n"));
            String line = lines.get(completionParams.getPosition().getLine());

            logger.info("Working line: " + line);
            logger.info("Trigger Character: " + completionParams.getContext().getTriggerCharacter());
            String triggerCharacter = completionParams.getContext().getTriggerCharacter();
            if (triggerCharacter.equals("/")) {
                getPathItems(line, workspaceRoot, completionParams, completionItems);
            } else if (triggerCharacter.equals(":")) {
                getBuildItems(line, workspaceRoot, completionParams, completionItems);
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

    private static void getBuildItems(String line, Path workspaceRoot, CompletionParams completionParams, List<CompletionItem> completionItems) {
        String path = getPath(line, completionParams.getPosition());
        path = path.substring(0, path.length() - 1);
        Path completePath = workspaceRoot.resolve(path + "/BUILD");

        logger.info(completePath.toString());

        if (Files.exists(completePath)) {
            logger.info("Found BUILD file");
            getBuildTargets(completePath, completionItems, completionParams);
        } else {
            logger.info("No BUILD file");
        }
    }

    private static void getBuildTargets(Path completePath, List<CompletionItem> completionItems, CompletionParams completionParams) {
        try {
            List<String> lines = Files.readAllLines(completePath);
            lines.parallelStream().map(String::stripLeading).filter(line -> {
                return line.startsWith("name");
            }).map(line -> {
                Pattern p = Pattern.compile("\"([^\"]*)\"");
                Matcher m = p.matcher(line);
                m.find();
                String name = m.group();
                return name.substring(1, name.length() - 1);
            }).forEach(name -> {
                CompletionItem completionItem = new CompletionItem(name);
                completionItem.setKind(CompletionItemKind.Value);
                completionItem.setInsertText(name);
                completionItem.setTextEdit(new TextEdit(new Range(completionParams.getPosition(), new Position(completionParams.getPosition().getLine(), completionParams.getPosition().getCharacter())), name));
                logger.info("Added item: " + completionItem);
                completionItems.add(completionItem);
            });
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static void getPathItems(String line, Path workspaceRoot, CompletionParams completionParams, List<CompletionItem> completionItems) throws IOException {
        char characterBefore = line.charAt(completionParams.getPosition().getCharacter() - 2);
        logger.info("Character before: " + characterBefore);
        if (characterBefore == '/') {
            logger.info("GET ROOT ITEMS");
            getFolders(workspaceRoot, completionParams, completionItems);
        } else if (Character.isAlphabetic(characterBefore) || Character.isDigit(characterBefore)) {
            logger.info("Found AlphaNum");
            String path = getPath(line, completionParams.getPosition());
            logger.info("Path: " + path);
            Path completePath = workspaceRoot.resolve(path);
            getFolders(completePath, completionParams, completionItems);
        }
    }

    private static void getFolders(Path path, CompletionParams completionParams, List<CompletionItem> completionItems) throws IOException {
        logger.info("Completed Path: " + path.toString());
        if (Files.exists(path)) {
            logger.info("Path exists");
            Files.list(path).parallel()
                    .filter(f -> f.toFile().isDirectory())
                    .map(f -> f.getFileName().toString())
                    .forEach(item -> {
                        CompletionItem completionItem = new CompletionItem(item);
                        completionItem.setKind(CompletionItemKind.Folder);
                        completionItem.setInsertText(item);
                        completionItem.setTextEdit(new TextEdit(new Range(completionParams.getPosition(), new Position(completionParams.getPosition().getLine(), completionParams.getPosition().getCharacter())), item));
                        logger.info("Added item: " + completionItem);
                        completionItems.add(completionItem);
                    });
        }
    }

    private static String getPath(String line, Position position) {
        StringBuilder path = new StringBuilder();
        int index = position.getCharacter() - 1;
        while (index >= 0 && line.charAt(index) != '"') { // Build string from back to front
            path.append(line.charAt(index));
            index--;
        }
        path.delete(path.length() - 2, path.length()); // Trim double slash off of the front
        return path.reverse().toString();
    }

}
