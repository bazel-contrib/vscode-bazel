package server.utils;

import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;


public class UtilityTest {

    @Before
    public void setup() {
    }

    @After
    public void tearDown() {

    }

    @Test
    public void nullAccess_returnsNull() {
        String result = Utility.nullAccess(() -> {
            throw new NullPointerException();
        });

        Assert.assertNull(result);
    }

    @Test
    public void nullAccess_returnsCorrectNonNullValue() {
        final String lowerCase = "abc";
        final String upperCase = "ABC";

        String result = Utility.nullAccess(lowerCase::toUpperCase);

        Assert.assertNotNull(result);
        Assert.assertEquals(upperCase, result);
    }
}
