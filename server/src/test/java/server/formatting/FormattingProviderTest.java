package server.formatting;

import java.io.File;
import java.util.concurrent.CompletableFuture;
import java.util.List;

import org.eclipse.lsp4j.DocumentFormattingParams;
import org.eclipse.lsp4j.FormattingOptions;
import org.eclipse.lsp4j.Position;
import org.eclipse.lsp4j.Range;
import org.eclipse.lsp4j.TextDocumentIdentifier;
import org.eclipse.lsp4j.TextEdit;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mockito;
import org.mockito.MockitoAnnotations;

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
    DocumentFormattingParams params;

    @Captor
    ArgumentCaptor<FormatInput> captor;

    CompletableFuture<List<? extends TextEdit>> output;

    @Before
    public void setUp() throws Exception {
        buildifier = Mockito.mock(Buildifier.class);
        documentTracker = Mockito.mock(DocumentTracker.class);
        FormattingProvider concreteFormattingProvider = new FormattingProvider(documentTracker, buildifier);
        formattingProvider = Mockito.spy(concreteFormattingProvider);
        file = Mockito.mock(File.class);
        params = new DocumentFormattingParams(new TextDocumentIdentifier("DummyUriString"), new FormattingOptions());
        captor = ArgumentCaptor.forClass(FormatInput.class);
        output = null;

        Mockito.doReturn(file).when(formattingProvider).getFileFromUriString(Mockito.any());
        Mockito.when(file.getName()).thenReturn("BUILD");
        Mockito.when(file.toURI()).thenReturn(null);
        Mockito.when(documentTracker.getContents(Mockito.any())).thenReturn("Dummy Contents");
        Mockito.when(buildifier.format(Mockito.any())).thenReturn(new FormatOutput("Dummy Output"));
    }

    @Test
    public void FormattingProviderReturnsBuildifierOutputAsResult() throws Exception {
        FormatOutput testOutput = new FormatOutput("The Framework Works!");
        Mockito.when(buildifier.format(Mockito.any())).thenReturn(testOutput);

        output = formattingProvider.getDocumentFormatting(params);
        Mockito.verify(buildifier).format(Mockito.any());

        List<? extends TextEdit> resultList = output.get();
        Assert.assertEquals(resultList.get(0).getNewText(), "The Framework Works!");
        
    }

    @Test
    public void FormattingProviderReturnsCorrectRangeForSingleLineFile() throws Exception {
        Mockito.when(documentTracker.getContents(Mockito.any())).thenReturn("A single line string");

        output = formattingProvider.getDocumentFormatting(params);
        Range result = output.get().get(0).getRange();
        Range expected = new Range(new Position(0, 0), new Position(0, 19));

        Assert.assertEquals(expected, result);
    }

    @Test
    public void FormattingProviderReturnsCorrectRangeForMultiLineFile() throws Exception {
        String multiLineString = "This string\nhas three lines\nand a trailing newline character\n";
        Mockito.when(documentTracker.getContents(Mockito.any())).thenReturn(multiLineString);
    

        output = formattingProvider.getDocumentFormatting(params);
        Range actual = output.get().get(0).getRange();
        Range expected = new Range(new Position(0, 0), new Position(2, 33));
    }

    @Test
    public void FormattingProviderPassesBUILDTypeToBuildifierWhenFileNameIsBUILD() throws Exception {
        Mockito.when(file.getName()).thenReturn("BUILD");
        
        output = formattingProvider.getDocumentFormatting(params);
        Mockito.verify(buildifier).format(captor.capture());

        BuildifierFileType type = captor.getValue().getType();

        Assert.assertEquals(BuildifierFileType.BUILD, type);
    }

    @Test
    public void FormattingProviderPassesWORKSPACETypeToBuildifierWhenFileNameIsWORKSPACE() throws Exception {
        Mockito.when(file.getName()).thenReturn("WORKSPACE");
        
        output = formattingProvider.getDocumentFormatting(params);
        Mockito.verify(buildifier).format(captor.capture());

        BuildifierFileType type = captor.getValue().getType();

        Assert.assertEquals(BuildifierFileType.WORKSAPCE, type);
    }

    @Test
    public void FormattingProviderPassesBZLTypeToBuildifierWhenFileHasExtensionBzl() throws Exception {
        Mockito.when(file.getName()).thenReturn("File.bzl");
        
        output = formattingProvider.getDocumentFormatting(params);
        Mockito.verify(buildifier).format(captor.capture());

        BuildifierFileType type = captor.getValue().getType();

        Assert.assertEquals(BuildifierFileType.BZL, type);
    }

    @Test 
    public void FormattingProviderPassesContentsStringToBuildifierFromFile() throws Exception {
        String contentsString = "This is the contents\nof the string!\n";
        Mockito.when(documentTracker.getContents(Mockito.any())).thenReturn(contentsString);

        output = formattingProvider.getDocumentFormatting(params);
        Mockito.verify(buildifier).format(captor.capture());

        String result = captor.getValue().getContent();

        Assert.assertEquals(contentsString, result);
    }
}
