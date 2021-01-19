package server.completion;

import java.io.IOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.CompletableFuture;
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
import server.BazelServices;

public class CompletionProvider {
    private static final Logger logger = LogManager.getLogger(CompletionProvider.class);

    /**
     * This method takes the completionParams and determines enough context to give a list of
     * potential completionItems. These items will appear as autocomplete options for the user.
     * @param workspaceRoot The path from the workspace root to the current file.
     * @param completionParams A object containing a TextDocumentIdentifier,
     *                        Position, and CompletionContext
     * @return A list of CompletionItems that can be used for autocomplete options for the user.
     */
    public static CompletableFuture<Either<List<CompletionItem>, CompletionList>> getCompletion(
            Path workspaceRoot, CompletionParams completionParams) {
        logger.info("Workspace Path: " + workspaceRoot.toString());
        List<CompletionItem> completionItems = new ArrayList<>();
        try {
            logger.info("URI: " + completionParams.getTextDocument().getUri().substring(7));
            List<String> lines = Arrays.asList(BazelServices.getDocumentTracker().getContents(URI.create(completionParams.getTextDocument().getUri())).split("\n"));
            String line = lines.get(completionParams.getPosition().getLine());

            logger.info("Working line: " + line);
            logger.info("Previous character: " + line.charAt(completionParams.getPosition().getCharacter() - 1));
            logger.info("Character before: " + line.charAt(
                    completionParams.getPosition().getCharacter() - 2));
            if (line.charAt(completionParams.getPosition().getCharacter() - 2) == '/') {
                logger.info("Found slash");
            } else if (Character.isAlphabetic(
                    line.charAt(completionParams.getPosition().getCharacter() - 2))
                    || Character.isDigit(line.charAt(completionParams.getPosition().getCharacter() - 2))) {
                logger.info("Found AlphaNum");
                String path = getPath(line, completionParams.getPosition());
                logger.info("Path: " + path);
                Path completePath = workspaceRoot.resolve(path);
                logger.info("Completed Path: " + completePath.toString());
                if (Files.exists(completePath)) {
                    logger.info("Path exists");
                    List<String> items = Files.list(completePath).parallel()
                            .filter(f -> f.toFile().isDirectory())
                            .map(f -> f.getFileName().toString()).collect(Collectors.toList());
                    items.forEach(item -> {
                        CompletionItem completionItem = new CompletionItem(item);
                        completionItem.setKind(CompletionItemKind.Folder);
                        completionItem.setInsertText(item);
                        completionItem.setTextEdit(new TextEdit(new Range(completionParams.getPosition(), new Position(completionParams.getPosition().getLine(), completionParams.getPosition().getCharacter() + item.length())), item));
                        logger.info("Added item: " + completionItem);
                        completionItems.add(completionItem);
                    });
                }
            }
        } catch (IOException e) {
            logger.info("Hit exception");
            e.printStackTrace();
        }

        logger.info(completionItems);
        return CompletableFuture.completedFuture(Either.forRight(new CompletionList(completionItems)));

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
