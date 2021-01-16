package server.analysis;

import com.google.common.base.Preconditions;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import server.starlark.ParseException;
import server.starlark.ParseInput;
import server.starlark.ParseOutput;
import server.starlark.StarlarkFacade;
import server.workspace.ProjectFolder;
import server.workspace.Workspace;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collection;
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

    public void analyze() throws AnalysisException {
        Preconditions.checkNotNull(Workspace.getInstance());
        Preconditions.checkNotNull(Workspace.getInstance().getRootFolder());

        final ProjectFolder rootFolder = Workspace.getInstance().getRootFolder();

        // Locate all of Bazel's BUILD and WORKSPACE files.
        List<BazelBuildFile> buildFiles;
        List<BazelWorkspaceFile> workspaceFiles;
        try {
            buildFiles = findBuildFiles(rootFolder);
            workspaceFiles = findWorkspaceFiles(rootFolder);
        } catch (IOException e) {
            throw new AnalysisException();
        }

        // Interpret and cache BUILD files using the starlark API.
        try {
            ParseInput input = new ParseInput();
            input.setFilePath(buildFiles.get(0).getPath());

            ParseOutput output = StarlarkFacade.parse(input);
        } catch (ParseException e) {
            throw new AnalysisException();
        }
    }

    private List<BazelBuildFile> findBuildFiles(ProjectFolder folder) throws IOException {
        return Files.walk(folder.getPath())
                .filter(Utilities::isBuildFile)
                .map(BazelBuildFile::fromPath)
                .collect(Collectors.toList());
    }

    private List<BazelWorkspaceFile> findWorkspaceFiles(ProjectFolder folder) throws IOException {
        return Files.walk(folder.getPath())
                .filter(Utilities::isWorkspaceFile)
                .map(BazelWorkspaceFile::fromPath)
                .collect(Collectors.toList());
    }
}
