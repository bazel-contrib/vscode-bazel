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
    public void test_nullable_returnsNullOnNullPointerException() {
        String result = Nullability.nullable(() -> {
            throw new NullPointerException();
        });

        Assert.assertNull(result);
    }

    @Test
    public void test_nullable_returnsCorrectNonNullValue() {
        final String lowerCase = "abc";
        final String upperCase = "ABC";

        String result = Nullability.nullable(lowerCase::toUpperCase);

        Assert.assertNotNull(result);
        Assert.assertEquals(upperCase, result);
    }

    @Test
    public void test_nullableOr_returnsFallbackIfNull() {
        final String fallback = "fallback";

        String result = Nullability.nullableOr(fallback, () -> {
            throw new NullPointerException();
        });

        Assert.assertNotNull(result);
        Assert.assertEquals(fallback, result);
    }

    @Test
    public void test_nullableOr_returnsValueButNotFallback() {
        final String fallback = "fallback";
        final String access = "access_value";

        String result = Nullability.nullableOr(fallback, () -> access);

        Assert.assertNotNull(result);
        Assert.assertEquals(access, result);
    }
}
