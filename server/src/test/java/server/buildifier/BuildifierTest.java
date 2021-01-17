package server.buildifier;

import com.google.common.jimfs.Configuration;
import com.google.common.jimfs.Jimfs;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

import server.utils.FileRepository;
import server.workspace.ExtensionConfig;
import server.workspace.Workspace;

import java.io.IOException;
import java.nio.file.FileSystem;
import java.nio.file.Files;
import java.nio.file.Path;

public class BuildifierTest {
    private static final String BUILDIFIER_CONFIG_PATH =
            "/valid/buildifier/location/" + Buildifier.getStandardExecutableName();
    private static final String BUILDIFIER_SYSTEM_PATH =
            "/usr/bin/" + Buildifier.getStandardExecutableName();
    private static final String BUILDIFIER_INVALID_PATH =
            "/path/that/doesnt/exist/" + Buildifier.getStandardExecutableName();
    final String BUILDIFIER_UNFORMATTED_CONTENT =
            "Not formatted content.";
    final String BUILDIFIER_FORMATTED_CONTENT =
            "Formatted content.";

    private FileSystem fileSystemJimf;
    private FileRepository fileRepositoryMock;
    private FakeRunner fakeRunner;
    private Buildifier buildifier;

    @Before
    public void setup() {
        fileSystemJimf = Jimfs.newFileSystem(Configuration.unix());

        fileRepositoryMock = Mockito.mock(FileRepository.class);
        Mockito.when(fileRepositoryMock.getFileSystem()).thenReturn(fileSystemJimf);

        fakeRunner = new FakeRunner();

        buildifier = new Buildifier();
        buildifier.setFileRepository(fileRepositoryMock);
        buildifier.setRunner(fakeRunner);
    }

    @After
    public void tearDown() {
        Workspace.getInstance().setExtensionConfig(null);

        fileSystemJimf = null;
        fileRepositoryMock = null;
        fakeRunner = null;
        buildifier = null;
    }

    @Test
    public void test_format_success() throws Exception {
        putBuildifierInPATH();

        final BuildifierFormatArgs args = new BuildifierFormatArgs();
        {
            args.setContent(BUILDIFIER_UNFORMATTED_CONTENT);
            args.setShouldApplyLintFixes(true);
            args.setType(BuildifierFileType.BUILD);
        }

        // Mimic the expected buildifier process output.
        {
            fakeRunner.targetOutput = BUILDIFIER_FORMATTED_CONTENT;
            fakeRunner.targetError = "";
            fakeRunner.targetExitCode = 0;
        }

        String output = buildifier.format(args);

        Assert.assertEquals(BUILDIFIER_FORMATTED_CONTENT, output);
    }

    @Test(expected = BuildifierException.class)
    public void test_format_failure() throws Exception {
        putBuildifierInPATH();

        final BuildifierFormatArgs args = new BuildifierFormatArgs();
        {
            args.setContent(BUILDIFIER_UNFORMATTED_CONTENT);
            args.setShouldApplyLintFixes(true);
            args.setType(BuildifierFileType.WORKSAPCE);
        }

        // Mimic the expected buildifier process output.
        {
            fakeRunner.targetOutput = "";
            fakeRunner.targetError = "Failed to format content.";
            fakeRunner.targetExitCode = 5;
        }

        String output = buildifier.format(args);
    }

    @Test
    public void test_exists_foundInExtensionConfig() throws Exception {
        // Set the extension config to have a valid path. This is the buildifier that should be used.
        putBuildifierInConfig();
        setBuildifierConfigLocation(BUILDIFIER_CONFIG_PATH);

        // Make sure system PATH searching is never reached. If it is reached, throw an exception to force
        // this test to fail.
        Mockito.when(fileRepositoryMock.searchPATH(Buildifier.getStandardExecutableName()))
                .thenThrow(new RuntimeException());

        // Buildifier should exist.
        Assert.assertTrue(buildifier.exists());
    }

    @Test
    public void test_exists_foundInSystemPATH() throws Exception {
        // Set the PATH to have a valid buildifier. This is the buildifier that should be used.
        putBuildifierInPATH();

        // Buildifier should exist.
        Assert.assertTrue(buildifier.exists());
    }

    @Test
    public void test_exists_notFoundAnywhere() throws Exception {
        // Buildifier should not exist if it doesn't exist in the extension config or the PATH.
        Assert.assertFalse(buildifier.exists());
    }

    @Test
    public void test_exists_notFoundWithInvalidConfigLocation() throws Exception {
        // Put a valid buildifier somewhere in the file system.
        putBuildifierInConfig();

        // If the extension config is invalid, it shouldn't return a valid path.
        setBuildifierConfigLocation(BUILDIFIER_INVALID_PATH);

        // Buildifier should not exist if it doesn't exist in the extension config or the PATH.
        Assert.assertFalse(buildifier.exists());
    }

    private void putBuildifierInPATH() throws IOException {
        final Path path = fileSystemJimf.getPath(BUILDIFIER_SYSTEM_PATH);
        Files.createDirectories(path.getParent());
        Files.createFile(path);

        final String filename = path.getFileName().toString();
        Mockito.when(fileRepositoryMock.searchPATH(filename)).thenReturn(path);
        Mockito.when(fileRepositoryMock.isExecutable(path)).thenReturn(true);
    }

    private void putBuildifierInConfig() throws IOException {
        final Path path = fileSystemJimf.getPath(BUILDIFIER_CONFIG_PATH);
        Files.createDirectories(path.getParent());
        Files.createFile(path);

        Mockito.when(fileRepositoryMock.isExecutable(path)).thenReturn(true);
    }

    private void setBuildifierConfigLocation(String location) {
        ExtensionConfig config = new ExtensionConfig();
        config.setBazel(new ExtensionConfig.Bazel());
        config.getBazel().setBuildifier(new ExtensionConfig.Buildifier());
        config.getBazel().getBuildifier().setExecutable(location);

        Workspace.getInstance().setExtensionConfig(config);
    }

    private static final class FakeRunner implements Runner {
        int targetExitCode = 0;
        String targetError = "";
        String targetOutput = "";
        RunnerInput input;

        @Override
        public RunnerOutput run(RunnerInput input) throws BuildifierException {
            this.input = input;

            final RunnerOutput output = new RunnerOutput();
            {
                output.setExitCode(targetExitCode);
                output.setRawError(targetError);
                output.setRawOutput(targetOutput);
            }

            return output;
        }
    }
}
