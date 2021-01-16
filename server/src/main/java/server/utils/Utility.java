package server.utils;

/**
 * Reusable utility methods that are usefuly in multiple contexts.
 */
public final class Utility {
    private Utility() {

    }

    /**
     * A wrapper around java accessors which mimics the "elvis" notation found in other languages such as
     * typescript. For example, say you had a deeply nested propery you wanted to access.
     *
     * ```
     * myObj.getPropertyA().getPropertyB().getPropertyC();
     * ```
     *
     * Rather than throwing a null pointer exception if `getPropertyB()` returned null, the entire statement
     * would instead just return null. This is similar to the "elvis" notation mentioned before.
     *
     * ```
     * myObj?.getPropertyA()?.getPropertyB()?.getPropertyC();
     * ```
     *
     * @param accessor A callback should be used to obtain the result.
     * @param <T> The type of object being accessed.
     * @return The result. Can be an object or null if it couldn't be found.
     */
    public static <T> T nullAccess(Function<T> accessor) {
        try {
            return accessor.invoke();
        } catch (NullPointerException e) {
            return null;
        }
    }

    /**
     * A functional interface which simply returns a result.
     * @param <R> The type of the result.
     */
    public interface Function<R>
    {
        R invoke();
    }
}
