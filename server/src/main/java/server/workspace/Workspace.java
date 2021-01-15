package server.workspace;

import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import java.util.Collection;
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

    public void setExtensionConfig(ExtensionConfig extensionConfig) {
        this.extensionConfig = extensionConfig;
    }

    public ProjectFolder getRootFolder() {
        return rootFolder;
    }

    public void setRootFolder(ProjectFolder rootFolder) {
        this.rootFolder = rootFolder;
    }

    public Iterable<ProjectFolder> getWorkspaceFolders() {
        return workspaceFolders;
    }

    public void addWorkspaceFolders(Collection<ProjectFolder> folders) {
        Preconditions.checkNotNull(folders);
        workspaceFolders.addAll(folders);
    }

    public void removeWorkspaceFolders(Collection<ProjectFolder> folders) {
        Preconditions.checkNotNull(folders);
        workspaceFolders.removeAll(folders);
    }
}
