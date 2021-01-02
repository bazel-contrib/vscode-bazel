package server.workspace;

public interface WorkspaceCallbacks {
    void onConfigChanged(ExtensionConfig config);

    void onProjectFoldersChanged(Iterable<ProjectFolder> projectFolders);
}
