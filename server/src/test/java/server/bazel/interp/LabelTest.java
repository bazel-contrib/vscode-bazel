package server.bazel.interp;

import org.junit.Assert;
import org.junit.Test;

public class LabelTest {


  @Test
  public void NoWorkSpace() throws LabelSyntaxException {
    String value = "//path/to:target";
    Label l = Label.parse(value);

    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("path/to", l.path());
    Assert.assertEquals("target", l.name());
    // might not work yet
    //Assert.assertEquals(value, l.value());
  }

  @Test
  public void NoWorkspaceOrPath() throws LabelSyntaxException {
    String value = ":something";
    Label l = Label.parse(value);

    Assert.assertEquals("", l.workspace());
    Assert.assertEquals("", l.path());
    Assert.assertEquals("something", l.name());
    // might not work yet
    //Assert.assertEquals(value, l.value());
  }
}
