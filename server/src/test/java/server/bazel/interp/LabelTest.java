package server.bazel.interp;

import org.junit.Assert;
import org.junit.Test;

public class LabelTest {
  @Test
  public void test_parse_onlyWorkspaceValue() throws LabelSyntaxException {
    String value = "@workspace";
    Label l = Label.parse(value);

    Assert.assertTrue(l.hasWorkspace());
    Assert.assertEquals(WorkspaceID.fromRaw("workspace"), l.workspace());
    Assert.assertFalse(l.hasPkg());
    Assert.assertFalse(l.hasTarget());
  }

  @Test
  public void test_parse_withNoWorkspace() throws LabelSyntaxException {
    String value = "//path/to:target";
    Label l = Label.parse(value);

    Assert.assertFalse(l.hasWorkspace());
    Assert.assertEquals(PkgID.fromRaw("path/to"), l.pkg());
    Assert.assertEquals(TargetID.fromRaw(true, "target"), l.target());
    Assert.assertFalse(l.isLocal());
    Assert.assertFalse(l.isSourceFile());
  }

  @Test
  public void test_parse_localDependency() throws LabelSyntaxException {
    String value = ":something";
    Label l = Label.parse(value);

    Assert.assertFalse(l.hasWorkspace());
    Assert.assertFalse(l.hasPkg());
    Assert.assertEquals(TargetID.fromRaw(true, "something"), l.target());
    Assert.assertTrue(l.isLocal());
    Assert.assertFalse(l.isSourceFile());
  }

  @Test
  public void test_parse_referenceRootPackage() throws LabelSyntaxException {
    String value = "@repo//:something";
    Label l = Label.parse(value);

    // This label has all parts, but the path is pointing to the root.
    Assert.assertTrue(l.hasWorkspace());
    Assert.assertTrue(l.hasPkg());
    Assert.assertTrue(l.hasTarget());

    Assert.assertEquals(TargetID.fromRaw(true, "something"), l.target());
    Assert.assertFalse(l.isLocal());
    Assert.assertFalse(l.isSourceFile());
  }

  @Test
  public void test_parse_failsWithTrailingSlash() {
    try {
      String value = "//path/to/:invalid";
      Label.parse(value);
      Assert.fail();
    } catch (LabelSyntaxException e) {
      // Will only get here if failed to parse.
    }
  }

  @Test
  public void test_parse_failsWhenGivenEmptyValue() {
    try {
      String value = "";
      Label.parse(value);
      Assert.fail();
    } catch (LabelSyntaxException ls) {
      // Will only get here if failed to parse.
    }
  }

  @Test
  public void test_parse_impliedPkgAndName() throws LabelSyntaxException {
    String value = "@foo";
    Label l = Label.parse(value);

    Assert.assertEquals(WorkspaceID.fromRaw("foo"), l.workspace());
    Assert.assertFalse(l.hasPkg());
    Assert.assertFalse(l.hasTarget());
    Assert.assertFalse(l.isLocal());
    Assert.assertFalse(l.isSourceFile());
  }

  @Test
  public void test_parse_sourceFileFromAbsoluteReference() throws LabelSyntaxException {
    String value = "@repo//path/to:my/src/file.cc";
    Label l = Label.parse(value);

    Assert.assertEquals(l.workspace(), WorkspaceID.fromRaw("repo"));
    Assert.assertEquals(l.pkg(), PkgID.fromRaw("path/to"));
    Assert.assertEquals(TargetID.fromRaw(true, "my/src/file.cc"), l.target());
  }

  @Test
  public void test_parse_sourceFileWithExtension() throws LabelSyntaxException {
    String value = "hello_world.cc";
    Label l = Label.parse(value);

    Assert.assertFalse(l.hasWorkspace());
    Assert.assertFalse(l.hasPkg());

    Assert.assertTrue(l.hasTarget());
    Assert.assertTrue(l.target().isSourceFile());
    Assert.assertEquals(TargetID.fromRaw(false, "hello_world.cc"), l.target());

    Assert.assertTrue(l.isSourceFile());
    Assert.assertFalse(l.isLocal());
  }

  @Test
  public void test_parse_sourceFileWithoutExtension() throws LabelSyntaxException {
    String value = "hello";
    Label l = Label.parse(value);

    Assert.assertFalse(l.hasWorkspace());
    Assert.assertFalse(l.hasPkg());

    Assert.assertTrue(l.hasTarget());
    Assert.assertTrue(l.target().isSourceFile());
    Assert.assertEquals(TargetID.fromRaw(false, "hello"), l.target());

    Assert.assertTrue(l.isSourceFile());
    Assert.assertFalse(l.isLocal());
  }

  @Test
  public void test_parse_returnsSameStringBack() throws LabelSyntaxException {
    String value = "@repo//path/to:my/src/file.cc";
    Label l = Label.parse(value);
    Assert.assertEquals(value, l.value());
  }
}