package server.buildifier;

import com.google.common.jimfs.Configuration;
import com.google.common.jimfs.Jimfs;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;
import server.workspace.ExtensionConfig;
import server.workspace.Workspace;

import java.net.URI;
import java.nio.file.FileSystem;
import java.nio.file.Path;

public class BuildifierFacadeTest {
    @Before
    public void setup() {
        // Update workspace.
        {
            final ExtensionConfig config = new ExtensionConfig();

            Workspace.getInstance().setExtensionConfig(config);
        }
    }

    @After
    public void tearDown() {

    }

    @Test
    public void success_locateBuildifier_customLocation() {

    }

    @Test
    public void success_locateBuildifier_defaultLocation() {

    }

    @Test
    public void fail_locateBuildifier_notFound() {

    }

    @Test
    public void fail_locateBuildifier_notExecutable() {

    }
}
