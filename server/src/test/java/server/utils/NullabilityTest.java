package server.utils;

import org.junit.After;
import org.junit.Assert;
import org.junit.Before;
import org.junit.Test;

public class NullabilityTest {

    @Before
    public void setup() {
    }

    @After
    public void tearDown() {

    }

    @Test
    public void test_access_returnsNullOnNullPointerException() {
        String result = Nullability.access(() -> {
            throw new NullPointerException();
        });

        Assert.assertNull(result);
    }

    @Test
    public void test_access_returnsCorrectNonNullValue() {
        final String lowerCase = "abc";
        final String upperCase = "ABC";

        String result = Nullability.access(lowerCase::toUpperCase);

        Assert.assertNotNull(result);
        Assert.assertEquals(upperCase, result);
    }
}
