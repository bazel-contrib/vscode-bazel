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
    private FileSystem fileSystemJimf;
    private FileRepository fileRepositoryMock;
    private Buildifier buildifier;

    @Before
    public void setup() {
        fileSystemJimf = Jimfs.newFileSystem(Configuration.unix());

        fileRepositoryMock = Mockito.mock(FileRepository.class);
        Mockito.when(fileRepositoryMock.getFileSystem()).thenReturn(fileSystemJimf);

        buildifier = new Buildifier();
        buildifier.setFileRepository(fileRepositoryMock);
    }

    @After
    public void tearDown() {
        Workspace.getInstance().setExtensionConfig(null);

        fileSystemJimf = null;
        fileRepositoryMock = null;
        buildifier = null;
    }

    @Test
    public void test_exists_foundInExtensionConfig() throws Exception {
        final String BUILDIFIER_PATH = "/valid/buildifier/location/" + Buildifier.getStandardExecutableName();

        // Set the extension config to have a valid path. This is the buildifier that should be used.
        putBuildifier(BUILDIFIER_PATH);
        setBuildifierExensionConfigLocation(BUILDIFIER_PATH);

        // Make sure system PATH searching is never reached. If it is reached, throw an exception to force
        // this test to fail.
        Mockito.when(fileRepositoryMock.searchPATH(Buildifier.getStandardExecutableName()))
                .thenThrow(new RuntimeException());

        // Buildifier should exist.
        Assert.assertTrue(buildifier.exists());
    }

    @Test
    public void test_exists_foundInSystemPATH() throws Exception {
        final String VALID_BUILDIFIER_PATH = "/usr/bin/" + Buildifier.getStandardExecutableName();

        // Set the PATH to have a valid buildifier. This is the buildifier that should be used.
        putBuildifierInPATH(VALID_BUILDIFIER_PATH);

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
        final String INVALID_BUILDIFIER_PATH = "/path/that/doesnt/exist/" + Buildifier.getStandardExecutableName();
        final String VALID_BUILDIFIER_PATH = "/valid/buildifier/location/" + Buildifier.getStandardExecutableName();

        // Put a valid buildifier somewhere in the file system.
        putBuildifier(VALID_BUILDIFIER_PATH);

        // If the extension config is invalid, it shouldn't return a valid path.
        setBuildifierExensionConfigLocation(INVALID_BUILDIFIER_PATH);

        // Buildifier should not exist if it doesn't exist in the extension config or the PATH.
        Assert.assertFalse(buildifier.exists());
    }

    private void putBuildifierInPATH(String location) throws IOException {
        final Path path = fileSystemJimf.getPath(location);
        Files.createDirectories(path.getParent());
        Files.createFile(path);

        final String filename = path.getFileName().toString();
        Mockito.when(fileRepositoryMock.searchPATH(filename)).thenReturn(path);
        Mockito.when(fileRepositoryMock.isExecutable(path)).thenReturn(true);
    }

    private void putBuildifier(String location) throws IOException {
        final Path path = fileSystemJimf.getPath(location);
        Files.createDirectories(path.getParent());
        Files.createFile(path);

        Mockito.when(fileRepositoryMock.isExecutable(path)).thenReturn(true);
    }

    private void setBuildifierExensionConfigLocation(String location) {
        ExtensionConfig config = new ExtensionConfig();
        config.setBazel(new ExtensionConfig.Bazel());
        config.getBazel().setBuildifier(new ExtensionConfig.Buildifier());
        config.getBazel().getBuildifier().setExecutable(location);

        Workspace.getInstance().setExtensionConfig(config);
    }
}
