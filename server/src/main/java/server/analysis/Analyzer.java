package server.analysis;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.workspace.ProjectFolder;
import server.workspace.Workspace;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

public class Analyzer {
    private static final Logger logger = LogManager.getLogger(Analyzer.class);
    private static final Analyzer instance = new Analyzer();

    private Analyzer() {

    }

    public static Analyzer getInstance() {
        return instance;
    }

    public void analyze() {
        logger.info("Analyzing project");
        List<BazelBuildFile> buildFiles = new ArrayList<>();
        List<BazelWorkspaceFile> workspaceFiles = new ArrayList<>();

        try {
            ProjectFolder folder = Workspace.getInstance().getRootFolder();
            logger.info("Analyzing folder=" + folder.getPath());

            List<Path> files = Files.walk(folder.getPath())
                    .filter(Utilities::isBuildFile)
                    .collect(Collectors.toList());

            for (Path file : files) {
                logger.info("BUILD File name=" + file);
                BazelBuildFile f = new BazelBuildFile();
                f.setPath(file);
                buildFiles.add(f);
            }

            files = Files.walk(folder.getPath())
                    .filter(Utilities::isWorkspaceFile)
                    .collect(Collectors.toList());

            for (Path file : files) {
                logger.info("WORKSPACE File name=" + file);
                BazelWorkspaceFile f = new BazelWorkspaceFile();
                f.setPath(file);
                workspaceFiles.add(f);
            }
        } catch (Exception e) {
            logger.error("Failed to walk=" + e.getMessage());
        }
    }
}
