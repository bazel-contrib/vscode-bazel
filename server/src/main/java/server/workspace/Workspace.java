package server.workspace;

import com.google.common.base.Preconditions;
import com.google.gson.Gson;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.util.HashSet;
import java.util.Set;

public class Workspace {
    private static final Logger logger = LogManager.getLogger(Workspace.class);
    private static final Workspace instance = new Workspace();

    private ExtensionConfig extensionConfig;
    private ProjectFolder rootFolder;
    private Set<ProjectFolder> workspaceFolders;

    private Workspace() {
        extensionConfig = null;
        rootFolder = null;
        workspaceFolders = new HashSet<>();
    }

    public static Workspace getInstance() {
        return instance;
    }

    public ExtensionConfig getExtensionConfig() {
        return extensionConfig;
    }

    public ProjectFolder getRootFolder() {
        return rootFolder;
    }

    public Set<ProjectFolder> getWorkspaceFolders() {
        return workspaceFolders;
    }

    public void updateExtensionConfig(UpdateExtensionConfigArgs args) {
        Preconditions.checkNotNull(args);
        Preconditions.checkNotNull(args.getSettings());

        Object settings = args.getSettings();
        Gson gson = new Gson();
        String json = new Gson().toJson(settings);

        extensionConfig = gson.fromJson(json, ExtensionConfig.class);
    }

    public void updateRootFolder(UpdateRootFolderArgs args) {
        Preconditions.checkNotNull(args);
        Preconditions.checkNotNull(args.getRootFolder());

        rootFolder = args.getRootFolder();
    }

    public void updateWorkspaceFolders(UpdateWorkspaceFoldersArgs args) {
        Preconditions.checkNotNull(args);
        Preconditions.checkNotNull(args.getFoldersToAdd());
        Preconditions.checkNotNull(args.getFoldersToRemove());

        workspaceFolders.removeAll(args.getFoldersToRemove());
        workspaceFolders.addAll(args.getFoldersToRemove());
    }
}
