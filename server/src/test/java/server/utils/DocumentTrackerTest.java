package server.utils;

import org.eclipse.lsp4j.*;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import java.net.URI;
import java.util.Collections;

public class DocumentTrackerTest {

    @Before
    public void setup() {
        DidOpenTextDocumentParams params = new DidOpenTextDocumentParams();
        params.setTextDocument(new TextDocumentItem("test.txt", "plaintext", 1, "arbitrary value"));
        DocumentTracker.getInstance().didOpen(params);
    }

    @Test
    public void testDidOpen() {
        Assert.assertEquals("arbitrary value", DocumentTracker.getInstance().getContents(URI.create("test.txt")));
    }

    @Test
    public void testDidChangeWithRange() {
        DidChangeTextDocumentParams changeParams = new DidChangeTextDocumentParams();
        changeParams.setTextDocument(new VersionedTextDocumentIdentifier("test.txt", 2));

        TextDocumentContentChangeEvent changeEvent = new TextDocumentContentChangeEvent();
        changeEvent.setText(" data");
        changeEvent.setRange(new Range(new Position(0,9), new Position(0, 15)));
        changeParams.setContentChanges(Collections.singletonList(changeEvent));

        DocumentTracker.getInstance().didChange(changeParams);
        Assert.assertEquals("arbitrary data", DocumentTracker.getInstance().getContents(URI.create("test.txt")));
    }

    @Test
    public void testDidChangeWithoutRange() {
        DidChangeTextDocumentParams changeParams = new DidChangeTextDocumentParams();
        changeParams.setTextDocument(new VersionedTextDocumentIdentifier("test.txt", 2));

        TextDocumentContentChangeEvent changeEvent = new TextDocumentContentChangeEvent();
        changeEvent.setText("random nonsense");
        changeParams.setContentChanges(Collections.singletonList(changeEvent));

        DocumentTracker.getInstance().didChange(changeParams);
        Assert.assertEquals("random nonsense", DocumentTracker.getInstance().getContents(URI.create("test.txt")));
    }

    @Test
    public void testDidChangeWithRangeMultiline() {
        DidOpenTextDocumentParams openParams = new DidOpenTextDocumentParams();
        openParams.setTextDocument(new TextDocumentItem("multiline.txt", "plaintext", 1, "multiple\nlines"));
        DocumentTracker.getInstance().didOpen(openParams);

        DidChangeTextDocumentParams changeParams = new DidChangeTextDocumentParams();
        changeParams.setTextDocument(new VersionedTextDocumentIdentifier("multiline.txt", 2));

        TextDocumentContentChangeEvent changeEvent = new TextDocumentContentChangeEvent();
        changeEvent.setText("stening\near");
        changeEvent.setRange(new Range(new Position(1, 2), new Position(1, 4)));
        changeParams.setContentChanges(Collections.singletonList(changeEvent));

        DocumentTracker.getInstance().didChange(changeParams);
        Assert.assertEquals("multiple\nlistening\nears", DocumentTracker.getInstance().getContents(URI.create("multiline.txt")));
    }
}
