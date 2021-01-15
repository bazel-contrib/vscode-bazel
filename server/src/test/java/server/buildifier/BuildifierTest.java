package server.buildifier;

import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

import static org.mockito.Mockito.*;

import server.utils.FileRepository;
import server.workspace.ExtensionConfig;
import server.workspace.Workspace;

import java.net.URI;
import java.nio.file.FileSystem;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public class BuildifierTest {
    @Before
    public void setup() {

    }

    @After
    public void tearDown() {

    }

    @Test
    public void success_locateBuildifier_customLocation() {

    }

    @Test
    public void success_locateBuildifier_defaultLocation() {
//        final String BAD_BUILDIFIER_CONFIG = "DONT_USE_THIS_LOCATION";
//        final String BAD_BUILDIFIER_LOCATION = "/path/that/doesnt/exist";
//        final String GOOD_BUILDIFIER_LOCATION = String.format("/usr/bin/%s", Buildifier.DEFAULT_BUILDIFIER_NAME);
//
//        final Buildifier buildifier = new Buildifier();
//
//        // Setup a jmif file system for mocking. The buildifier checks the system
//        // PATH to see if there is a buildifier binary available.
//        final FileSystem mockFileSystem = mock(FileSystem.class);
//        final FileRepository mockFileRepository = mock(FileRepository.class);
//
//        // Make it so the exension config isn't used.
//        {
//            ExtensionConfig config = new ExtensionConfig();
//            config.setBazel(new ExtensionConfig.Bazel());
//            config.getBazel().setBuildifier(new ExtensionConfig.Buildifier());
//            config.getBazel().getBuildifier().setExecutable(BAD_BUILDIFIER_CONFIG);
//
//            Workspace.getInstance().setExtensionConfig(config);
//
//            // Make the config return a path that doesn't exist.
//            when(mockFileSystem.getPath(BAD_BUILDIFIER_CONFIG))
//                    .thenReturn(Paths.get(BAD_BUILDIFIER_LOCATION));
//
//            when(mockFileRepository.getFileSystem())
//                    .thenReturn(mockFileSystem);
//            when(mockFileRepository.searchPATH(Buildifier.DEFAULT_BUILDIFIER_NAME))
//                    .thenReturn(
//        }
//
//        //
//        buildifier.setFileRepository(mockFileRepository);
//
//        final boolean buildifierExists = buildifier.exists();
    }

    @Test
    public void fail_locateBuildifier_notFound() {

    }

    @Test
    public void fail_locateBuildifier_notExecutable() {

    }
}
