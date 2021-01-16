package server.workspace;

import java.util.Collection;

public class UpdateWorkspaceFoldersArgs {
    Collection<ProjectFolder> foldersToRemove;
    Collection<ProjectFolder> foldersToAdd;

    public Collection<ProjectFolder> getFoldersToRemove() {
        return foldersToRemove;
    }

    public void setFoldersToRemove(Collection<ProjectFolder> foldersToRemove) {
        this.foldersToRemove = foldersToRemove;
    }

    public Collection<ProjectFolder> getFoldersToAdd() {
        return foldersToAdd;
    }

    public void setFoldersToAdd(Collection<ProjectFolder> foldersToAdd) {
        this.foldersToAdd = foldersToAdd;
    }
}
