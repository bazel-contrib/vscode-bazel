package server.formatting;

import java.io.File;
import java.util.concurrent.CompletableFuture;
import java.util.List;

import org.eclipse.lsp4j.DocumentFormattingParams;
import org.eclipse.lsp4j.FormattingOptions;
import org.eclipse.lsp4j.TextDocumentIdentifier;
import org.eclipse.lsp4j.TextEdit;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

import server.buildifier.Buildifier;
import server.buildifier.BuildifierException;
import server.buildifier.BuildifierFileType;
import server.buildifier.FormatInput;
import server.buildifier.FormatOutput;
import server.utils.DocumentTracker;

public class FormattingProviderTest {

    
    FormattingProvider formattingProvider;

    DocumentTracker documentTracker;
    Buildifier buildifier;
    File file;

    @Before
    public void setUp() {
        formattingProvider = Mockito.spy(FormattingProvider.class);
        buildifier = Mockito.mock(Buildifier.class);
        documentTracker = Mockito.mock(DocumentTracker.class);
        file = Mockito.mock(File.class);

        //Mockito.when(formattingProvider.getBuildifier()).thenReturn(buildifier);
        Mockito.doReturn(buildifier).when(formattingProvider).getBuildifier();
        //Mockito.when(formattingProvider.getFileFromUriString(Mockito.any())).thenReturn(file);
        Mockito.doReturn(file).when(formattingProvider).getFileFromUriString(Mockito.any());
        Mockito.when(file.getName()).thenReturn("BUILD");
        Mockito.when(file.toURI()).thenReturn(null);
        Mockito.when(documentTracker.getContents(Mockito.any())).thenReturn("Dummy Contents");
    }

    @Test
    public void mockingFrameworkFunctionsAsExpected() throws Exception {
        FormatOutput testOutput = new FormatOutput("The Framework Works!");
        Mockito.when(buildifier.format(Mockito.any())).thenReturn(testOutput);
        DocumentFormattingParams params = getDummyParams();

        CompletableFuture<List<? extends TextEdit>> result = formattingProvider.getDocumentFormatting(params);
        
        Mockito.verify(buildifier).format(Mockito.any());

        List<? extends TextEdit> resultList = result.get();

        Assert.assertEquals(resultList.get(0).getNewText(), "The Framework Works!");
        
    }

    private DocumentFormattingParams getDummyParams() {
        return new DocumentFormattingParams(new TextDocumentIdentifier("DummyUriString"), new FormattingOptions());
    }
    
}
