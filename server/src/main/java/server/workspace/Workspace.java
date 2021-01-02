package server.workspace;

import com.google.gson.Gson;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.eclipse.lsp4j.DidChangeConfigurationParams;
import org.eclipse.lsp4j.DidChangeWatchedFilesParams;
import org.eclipse.lsp4j.DidChangeWorkspaceFoldersParams;
import org.eclipse.lsp4j.WorkspaceFolder;
import server.utils.Observatory;

import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashSet;

public class Workspace {
    private static final Logger logger = LogManager.getLogger(Workspace.class);
    private static final Workspace instance = new Workspace();

    private final Observatory<WorkspaceCallbacks> observatory;
    private ExtensionConfig extensionConfig;
    private HashSet<ProjectFolder> projectFolders;

    private Workspace() {
        observatory = new Observatory<>();
        extensionConfig = null;
        projectFolders = new HashSet<>();
    }

    public static Workspace getInstance() {
        return instance;
    }

    public Observatory<WorkspaceCallbacks> getObservatory() {
        return observatory;
    }

    public ExtensionConfig getExtensionConfig() {
        return extensionConfig;
    }

    public Iterable<ProjectFolder> getProjectFolders() {
        return projectFolders;
    }

    public void processConfigurationChange(DidChangeConfigurationParams params) {
        Object settings = params.getSettings();

        Gson gson = new Gson();
        String json = new Gson().toJson(settings);
        extensionConfig = gson.fromJson(json, ExtensionConfig.class);
        logger.info(String.format("Configuration changed: %s", json));

        getObservatory().notifyListeners(c -> c.onConfigChanged(extensionConfig));
    }

    public void processWatchedFilesChange(DidChangeWatchedFilesParams params) {

    }

    public void processWorkspaceFoldersChange(DidChangeWorkspaceFoldersParams params) {
        for (WorkspaceFolder folder : params.getEvent().getAdded()) {
            URI uri = URI.create(folder.getUri());
            Path path = Paths.get(uri);
            ProjectFolder f = new ProjectFolder(folder.getName(), path);
            projectFolders.add(f);
        }

        for (WorkspaceFolder folder : params.getEvent().getRemoved()) {
            URI uri = URI.create(folder.getUri());
            Path path = Paths.get(uri);
            ProjectFolder f = new ProjectFolder(folder.getName(), path);
            projectFolders.remove(f);
        }

        getObservatory().notifyListeners(c -> c.onProjectFoldersChanged(projectFolders));
    }
}
