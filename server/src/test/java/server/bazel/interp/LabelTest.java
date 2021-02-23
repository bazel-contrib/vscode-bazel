package server.bazel.interp;

import org.junit.Assert;
import org.junit.Test;

public class LabelTest {
  @Test
  public void NoWorkSpace() throws LabelSyntaxException {
    String value = "//path/to:target";
    Label l = Label.parse(value);

    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("path/to", l.pkg());
    Assert.assertEquals("target", l.name());
    // might not work yet
    //Assert.assertEquals(value, l.value());
  }

  @Test
  public void NoWorkspaceOrPackage() throws LabelSyntaxException {
    String value = ":something";
    Label l = Label.parse(value);

    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("", l.pkg());
    Assert.assertEquals("something", l.name());
    // might not work yet
    //Assert.assertEquals(value, l.value());
  }

  @Test
  public void ThrowsException() {
    try {
      String value = "//path/to/:invalid";
      Label l = Label.parse(value);
      Assert.assertTrue(false);
    } catch (LabelSyntaxException ls) {
      Assert.assertTrue(true);
    }
  }

  @Test
  public void EmptyLabel() {
    try {
      String value = "";
      Label l = Label.parse(value);
      Assert.assertTrue(false);
    } catch (LabelSyntaxException ls) {
      Assert.assertTrue(true);
    }
  }

  @Test
  public void NoPackageOrName() throws LabelSyntaxException {
    String value = "@foo";
    Label l = Label.parse(value);

    Assert.assertEquals("foo", l.workspace());
    Assert.assertEquals("", l.pkg());
    Assert.assertEquals("", l.name());
  }

  @Test
  public void SourceFileTest1() throws LabelSyntaxException {
    String value = "hello_world.cc";
    Label l = Label.parse(value);

    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("hello_world.cc", l.pkg());
    Assert.assertEquals("", l.name());
    Assert.assertTrue(l.isSourceFile());
  }

  @Test
  public void SourceFileTest2() throws LabelSyntaxException {
    String value = "hello";
    Label l = Label.parse(value);
    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("hello", l.pkg());
    Assert.assertEquals("", l.name());
    Assert.assertTrue(l.isSourceFile());
  }

}
