package server.utils;

/**
 * Reusable utility methods that are usefuly in multiple contexts.
 */
public final class Nullability {
    private Nullability() {

    }

    /**
     * A wrapper around java accessors which mimics the "elvis" notation found in other languages such as
     * typescript or dart. For example, say you had a deeply nested propery you wanted to access.
     * <p>
     * ```
     * myObj.getPropertyA().getPropertyB().getPropertyC();
     * ```
     * <p>
     * Rather than throwing a null pointer exception if `getPropertyB()` returned null, the entire statement
     * would instead just return null. This is similar to the "elvis" notation mentioned before.
     * <p>
     * ```
     * myObj?.getPropertyA()?.getPropertyB()?.getPropertyC();
     * ```
     *
     * @param accessor A callback should be used to obtain the result.
     * @param <T>      The type of object being accessed.
     * @return The result. Can be an object or null if it couldn't be found.
     */
    public static <T> T access(Callbacks.Function<T> accessor) {
        try {
            return accessor.invoke();
        } catch (NullPointerException e) {
            return null;
        }
    }
}
