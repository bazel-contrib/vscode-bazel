package server.services;

import org.eclipse.lsp4j.*;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

import java.util.Collections;

public class TextDocumentTest {
    private TextDocument service;

    @Before
    public void setup() {
        service = Mockito.spy(new TextDocument());
    }

    @After
    public void tearDown() {
        service = null;
    }

    @Test
    public void testDidOpen() {
        DidOpenTextDocumentParams params = new DidOpenTextDocumentParams();
        params.setTextDocument(new TextDocumentItem("test.txt", "plaintext", 1, "arbitrary value"));

        service.didOpen(params);
        Mockito.verify(service).didOpen(params);
    }

    @Test
    public void testDidChange() {
        DidOpenTextDocumentParams params = new DidOpenTextDocumentParams();
        params.setTextDocument(new TextDocumentItem("test.txt", "plaintext", 1, "arbitrary value"));
        service.didOpen(params);

        DidChangeTextDocumentParams changeParams = new DidChangeTextDocumentParams();
        changeParams.setTextDocument(new VersionedTextDocumentIdentifier("test.txt", 2));

        TextDocumentContentChangeEvent changeEvent = new TextDocumentContentChangeEvent();
        changeEvent.setText(" data");
        changeEvent.setRange(new Range(new Position(0, 9), new Position(0, 15)));
        changeParams.setContentChanges(Collections.singletonList(changeEvent));

        service.didChange(changeParams);
        Mockito.verify(service).didChange(changeParams);
    }

    @Test
    public void testDidClose() {
        DidCloseTextDocumentParams params = new DidCloseTextDocumentParams();
        params.setTextDocument(new TextDocumentIdentifier("test.txt"));

        service.didClose(params);
        Mockito.verify(service).didClose(params);
    }

    @Test
    public void testDidSave() {
        service.didSave(new DidSaveTextDocumentParams());
        Mockito.verify(service).didSave(new DidSaveTextDocumentParams());
    }
}
