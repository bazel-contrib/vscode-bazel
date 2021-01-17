package server.utils;

/**
 * Common callback functions (e.g. functional interfaces).
 */
public final class Callbacks {
    private Callbacks() {

    }

    /**
     * A functional interface which takes in no arguments and returns a result.
     *
     * @param <R> The type of the result.
     */
    public interface Function<R> {
        R invoke();
    }

    /**
     * A functional interface which takes in an argument and returns nothing.
     *
     * @param <T> The type of the argument.
     */
    public interface Consumer<T> {
        void invoke(T param);
    }

    /**
     * A functional interface which takes in an argument and returns a result.
     *
     * @param <R> The type of the result.
     * @param <T> The type of the argument.
     */
    public interface Procedure<R, T> {
        R invoke(T param);
    }
}
