package server.buildifier;

import com.google.common.jimfs.Configuration;
import com.google.common.jimfs.Jimfs;
import com.google.gson.*;
import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;
import org.mockito.Mockito;

import server.dispatcher.CommandDispatcher;
import server.dispatcher.CommandOutput;
import server.utils.FileRepository;
import server.workspace.ExtensionConfig;
import server.workspace.Workspace;

import java.io.*;
import java.nio.file.FileSystem;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

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
    final String BUILDIFIER_FILE_WITH_BAD_SYNTAX = "load(\"@rules_cc//cc:defs.bzl\", \"cc_binary\", \"cc_library\")"
            + "cc_library(name = \"hello_greet\", srcs = [\"hello_greet.cc\"], hdrs = [\"hello_greet.h\"],)"
            + "cc_binary(name = \"hello_world\", srcs = [\"hello_world.cc\"], deps = [\":hello_greet\","
            + "\"//lib:hello_time\",],bad)";
    final String BUILDIFIER_CONTENT_WITH_WARNINGS = "{\"success\": false,\"files\": [{\"filename\": \"BUILD\","
            + "\"formatted\": false, \"valid\": true, \"warnings\": [{\"start\": {\"line\": 16, \"column\": 5"
            + "}, \"end\": { \"line\": 16, \"column\": 8}, \"category\": \"positional-args\", \"actionable\": true,"
            + "\"message\": \"All calls to rules or macros should pass arguments by keyword (arg_name=value) syntax.\","
            + "\"url\": \"https://github.com/bazelbuild/buildtools/blob/master/WARNINGS.md#positional-args\"}]}]}";

    private FileSystem fileSystemJimf;
    private FileRepository fileRepositoryMock;
    private CommandDispatcher dispatcherMock;
    private Buildifier buildifier;

    @Before
    public void setup() {
        fileSystemJimf = Jimfs.newFileSystem(Configuration.unix());

        fileRepositoryMock = Mockito.mock(FileRepository.class);
        Mockito.when(fileRepositoryMock.getFileSystem()).thenReturn(fileSystemJimf);

        dispatcherMock = Mockito.mock(CommandDispatcher.class);

        buildifier = new Buildifier();
        buildifier.setFileRepository(fileRepositoryMock);
        buildifier.setDispatcher(dispatcherMock);
    }

    @After
    public void tearDown() {
        Workspace.getInstance().setExtensionConfig(null);

        fileSystemJimf = null;
        fileRepositoryMock = null;
        dispatcherMock = null;
        buildifier = null;
    }

    @Test
    public void test_format_success() throws Exception {
        putBuildifierInPATH();

        final FormatInput args = new FormatInput();
        {
            args.setContent(BUILDIFIER_UNFORMATTED_CONTENT);
            args.setShouldApplyLintFixes(true);
            args.setType(BuildifierFileType.BUILD);
        }

        // Mimic the expected buildifier process output.
        {
            final CommandOutput mockOut = new CommandOutput(
                    byteArrayOutputStreamFromString(BUILDIFIER_FORMATTED_CONTENT),
                    byteArrayOutputStreamFromString(""),
                    0
            );

            Mockito.when(dispatcherMock.dispatch(Mockito.any())).thenReturn(Optional.of(mockOut));
        }

        FormatOutput output = buildifier.format(args);

        Assert.assertEquals(BUILDIFIER_FORMATTED_CONTENT, output.getResult());
    }

    @Test(expected = BuildifierException.class)
    public void test_format_failure() throws Exception {
        putBuildifierInPATH();

        final FormatInput args = new FormatInput();
        {
            args.setContent(BUILDIFIER_UNFORMATTED_CONTENT);
            args.setShouldApplyLintFixes(true);
            args.setType(BuildifierFileType.WORKSAPCE);
        }

        // Mimic the expected buildifier process output.
        {
            final CommandOutput mockOut = new CommandOutput(
                    byteArrayOutputStreamFromString(""),
                    byteArrayOutputStreamFromString("Failed to format content."),
                    5
            );

            Mockito.when(dispatcherMock.dispatch(Mockito.any())).thenReturn(Optional.of(mockOut));
        }

        FormatOutput output = buildifier.format(args);
    }

    @Test
    public void test_lint_warnings() throws Exception {
        putBuildifierInPATH();
        Gson gson = new Gson();

        final LintInput input = new LintInput();
        {
            input.setContent(BUILDIFIER_FILE_WITH_BAD_SYNTAX);
            input.setShouldApplyLintWarnings(true);
            input.setShouldApplyLintFixes(false);
            input.setType(BuildifierFileType.BUILD);
        }


        // Mimic the dispatcher.
        {
            final CommandOutput mockOut = new CommandOutput(
                    byteArrayOutputStreamFromString(BUILDIFIER_CONTENT_WITH_WARNINGS),
                    byteArrayOutputStreamFromString(""),
                    0
            );

            Mockito.when(dispatcherMock.dispatch(Mockito.any())).thenReturn(Optional.of(mockOut));
        }

        LintOutput expected = gson.fromJson(BUILDIFIER_CONTENT_WITH_WARNINGS, LintOutput.class);
        LintOutput actual = buildifier.lint(input);

        Assert.assertNotNull(actual);
        Assert.assertEquals(expected.getSuccess(), actual.getSuccess());
        Assert.assertEquals(expected.getFiles().size(), actual.getFiles().size());

        String expectedJson = gson.toJson(expected);
        String actualJson = gson.toJson(actual);
        Assert.assertEquals(expectedJson, actualJson);
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

    private ByteArrayOutputStream byteArrayOutputStreamFromString(String msg) throws IOException {
        ByteArrayOutputStream res = new ByteArrayOutputStream();
        res.write(msg.getBytes());
        return res;
    }
}
