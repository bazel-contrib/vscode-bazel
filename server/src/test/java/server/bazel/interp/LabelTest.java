package server.bazel.interp;

import org.junit.Assert;
import org.junit.Test;

public class LabelTest {
  @Test
  public void test_parse_withNoWorkspace() throws LabelSyntaxException {
    String value = "//path/to:target";
    Label l = Label.parse(value);

    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("path/to", l.pkg());
    Assert.assertEquals("target", l.name());
    Assert.assertFalse(l.isLocal());
    Assert.assertFalse(l.isSourceFile());
  }

  @Test
  public void test_parse_localDependency() throws LabelSyntaxException {
    String value = ":something";
    Label l = Label.parse(value);

    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("", l.pkg());
    Assert.assertEquals("something", l.name());
    Assert.assertTrue(l.isLocal());
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

    Assert.assertEquals("foo", l.workspace());
    Assert.assertEquals("", l.pkg());
    Assert.assertEquals("", l.name());
    Assert.assertFalse(l.isLocal());
    Assert.assertFalse(l.isSourceFile());
  }

  @Test
  public void test_parse_sourceFileWithExtension() throws LabelSyntaxException {
    String value = "hello_world.cc";
    Label l = Label.parse(value);

    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("hello_world.cc", l.pkg());
    Assert.assertEquals("", l.name());
    Assert.assertTrue(l.isSourceFile());
    Assert.assertFalse(l.isLocal());
  }

  @Test
  public void test_parse_sourceFileWithoutExtension() throws LabelSyntaxException {
    String value = "hello";
    Label l = Label.parse(value);
    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("hello", l.pkg());
    Assert.assertEquals("", l.name());
    Assert.assertTrue(l.isSourceFile());
    Assert.assertFalse(l.isLocal());
  }
}
