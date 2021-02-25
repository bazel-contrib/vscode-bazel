package server.formatting;

import java.io.File;
import java.util.concurrent.CompletableFuture;

import org.eclipse.lsp4j.DocumentFormattingParams;
import org.eclipse.lsp4j.FormattingOptions;
import org.eclipse.lsp4j.TextDocumentIdentifier;
import org.junit.Assert;
import org.junit.BeforeEach;
import org.junit.Test;
import org.mockito.Mockito;

import server.buildifier.Buildifier;
import server.utils.DocumentTracker;

public class FormattingProviderTest {

    
    FormattingProvider formattingProvider;

    DocumentTracker documentTracker;
    Buildifier buildifier;
    File file;

    @BeforeEach
    public void setUp() {
        formattingProvider = Mockito.spy(FormattingProvider.class);
        buildifier = Mockito.mock(Buildifier.class);
        documentTracker = Mockito.mock(DocumentTracker.class);
        file = Mockito.mock(File.class);

        Mockito.when(formattingProvider.getBuildifier()).thenReturn(buildifier);
        Mockito.when(formattingProvider.getFileFromUriString()).thenReturn(file);
        Mockito.when(file.getName()).thenReturn("BUILD");
        Mockito.when(file.toURI()).thenReturn(null);
        Mockito.when(documentTracker.getContents(Mockito.any())).thenReturn("Dummy Contents");
    }

    @Test 
    public void mockingFrameworkFunctionsAsExpected() {
        FormatOutput testOutput = new FormatOutput("The Framework Works!");
        Mockito.when(buildifier.format(Mockito.any())).thenReturn(testOutput);
        DocumentFormattingParams params = getDummyParams();

        CompletableFuture<List<? extends TextEdit>> result = formattingProvider.getDocumentFormatting(params);
        
        Mockito.verify(buildifier.format(Mockito.any()));

        List<? extends TextEdit> resultList = result.get();

        Assert.assertEquals(resultList.get(0).getNewText(), "The Framework Works!");
    }

    private DocumentFormattingParams getDummyParams() {
        return new DocumentFormattingParams(new TextDocumentIdentifier("DummyUriString"), new FormattingOptions());
    }
    
}
