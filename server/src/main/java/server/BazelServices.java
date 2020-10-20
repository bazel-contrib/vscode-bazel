package server;

import org.eclipse.lsp4j.DidChangeConfigurationParams;
import org.eclipse.lsp4j.DidChangeTextDocumentParams;
import org.eclipse.lsp4j.DidChangeWatchedFilesParams;
import org.eclipse.lsp4j.DidCloseTextDocumentParams;
import org.eclipse.lsp4j.DidOpenTextDocumentParams;
import org.eclipse.lsp4j.DidSaveTextDocumentParams;
import org.eclipse.lsp4j.services.LanguageClient;
import org.eclipse.lsp4j.services.LanguageClientAware;
import org.eclipse.lsp4j.services.TextDocumentService;
import org.eclipse.lsp4j.services.WorkspaceService;

import java.nio.file.Path;

public class BazelServices implements TextDocumentService, WorkspaceService, LanguageClientAware {
    private LanguageClient languageClient;
    private Path workspaceRoot;

    @Override
    public void didOpen(DidOpenTextDocumentParams params) {
        System.out.println("Did Open");
        System.out.println(params.toString());
    }

    @Override
    public void didChange(DidChangeTextDocumentParams params) {
        System.out.println("Did Change");
        System.out.println(params.toString());
    }

    @Override
    public void didClose(DidCloseTextDocumentParams params) {
        System.out.println("Did Close");
        System.out.println(params.toString());
    }

    @Override
    public void didSave(DidSaveTextDocumentParams params) {
        System.out.println("Did Save");
        System.out.println(params.toString());
    }

    @Override
    public void didChangeConfiguration(DidChangeConfigurationParams params) {
        System.out.println("Did Change Configuration");
        System.out.println(params.toString());
    }

    @Override
    public void didChangeWatchedFiles(DidChangeWatchedFilesParams params) {
        System.out.println("Did Change Watched Files");
        System.out.println(params.toString());
    }

    @Override
    public void connect(LanguageClient client) {
        languageClient = client;
    }

    public void setWorkspaceRoot(Path workspaceRoot) {
        this.workspaceRoot = workspaceRoot;
    }
}
