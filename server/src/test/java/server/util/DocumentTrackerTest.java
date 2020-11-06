package server.util;

import org.eclipse.lsp4j.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.util.Collections;

public class DocumentTrackerTest {
    private DocumentTracker tracker;

    @BeforeEach
    void setup() {
        tracker = new DocumentTracker();
        DidOpenTextDocumentParams params = new DidOpenTextDocumentParams();
        params.setTextDocument(new TextDocumentItem("test.txt", "plaintext", 1, "arbitrary value"));
        tracker.didOpen(params);
    }

    @AfterEach
    void tearDown() {
        tracker = null;
    }

    @Test
    void testDidOpen() {
        Assertions.assertEquals("arbitrary value", tracker.getContents(URI.create("test.txt")));
    }

    @Test
    void testDidChangeWithRange() {
        DidChangeTextDocumentParams changeParams = new DidChangeTextDocumentParams();
        changeParams.setTextDocument(new VersionedTextDocumentIdentifier("test.txt", 2));
        TextDocumentContentChangeEvent changeEvent = new TextDocumentContentChangeEvent();
        changeEvent.setText(" data");
        changeEvent.setRange(new Range(new Position(0,9), new Position(0, 15)));
        changeParams.setContentChanges(Collections.singletonList(changeEvent));
        tracker.didChange(changeParams);
        Assertions.assertEquals("arbitrary data", tracker.getContents(URI.create("test.txt")));
    }

    @Test
    void testDidChangeWithoutRange() {
        DidChangeTextDocumentParams changeParams = new DidChangeTextDocumentParams();
        changeParams.setTextDocument(new VersionedTextDocumentIdentifier("test.txt", 2));
        TextDocumentContentChangeEvent changeEvent = new TextDocumentContentChangeEvent();
        changeEvent.setText("random nonsense");
        changeParams.setContentChanges(Collections.singletonList(changeEvent));
        tracker.didChange(changeParams);
        Assertions.assertEquals("random nonsense", tracker.getContents(URI.create("test.txt")));
    }

    @Test
    void testDidChangeWithRangeMultiline() {
        DidOpenTextDocumentParams openParams = new DidOpenTextDocumentParams();
        openParams.setTextDocument(new TextDocumentItem("multiline.txt", "plaintext", 1, "multiple\nlines"));
        tracker.didOpen(openParams);
        DidChangeTextDocumentParams changeParams = new DidChangeTextDocumentParams();
        changeParams.setTextDocument(new VersionedTextDocumentIdentifier("multiline.txt", 2));
        TextDocumentContentChangeEvent changeEvent = new TextDocumentContentChangeEvent();
        changeEvent.setText("stening\near");
        changeEvent.setRange(new Range(new Position(1, 2), new Position(1, 4)));
        changeParams.setContentChanges(Collections.singletonList(changeEvent));
        tracker.didChange(changeParams);
        Assertions.assertEquals("multiple\nlistening\nears", tracker.getContents(URI.create("multiline.txt")));
    }
}
