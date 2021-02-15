package server.formatting;

import java.util.concurrent.CompletableFuture;

import org.eclipse.lsp4j.DocumentFormattingParams;

public class FormattingProvider {

    public static CompletableFuture<List<TextEdit>> getDocumentFormatting(DocumentFormattingParams params) {
        return null;
    }
}