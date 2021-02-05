package server.workspace;

import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.bazel.cli.Bazel;
import server.bazel.cli.BazelServerException;
import server.bazel.tree.BuildTarget;
import server.bazel.tree.Package;
import server.bazel.tree.WorkspaceTree;

import java.util.*;

public class Workspace {
    private static final Logger logger = LogManager.getLogger(Workspace.class);
    private static final Workspace instance = new Workspace();

    private ExtensionConfig extensionConfig;
    private ProjectFolder rootFolder;
    private Set<ProjectFolder> workspaceFolders;
    private WorkspaceTree workspaceTree = new WorkspaceTree(new Package("/"));

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

    public void initializeWorkspace() {
        List<BuildTarget> buildTargets;
        try {
            buildTargets = Bazel.getBuildTargets();
            buildTargets.forEach(this::addTargetToTree);
        } catch (BazelServerException e) {
            logger.info(e.getMessage());
        }
    }

    private void addTargetToTree(BuildTarget target) {
        String[] pathParts = target.getPath().toString().split("/");
        WorkspaceTree.Node node = workspaceTree.getRoot();
        for (String part : pathParts) {
            if (!part.isEmpty()) {
                Optional<WorkspaceTree.Node> child = node.getChild(part);
                if (child.isPresent()) {
                    node = child.get();
                } else {
                    WorkspaceTree.Node childNode = node.addChild(new Package(part));
                    node = childNode;
                }
            }
        }
        node.getValue().addBuildTarget(target);
    }
}
