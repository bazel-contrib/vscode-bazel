package server.utils;

import java.util.HashSet;
import java.util.Set;
import java.util.function.Function;

public class Observatory<L> {
    private Set<L> listeners = new HashSet<>();

    public void notifyListeners(Function<L, Void> callback) {
        for (L listener : listeners) {
            callback.apply(listener);
        }
    }

    public boolean containsListener(L listener) {
        return listeners.contains(listener);
    }

    public void addListener(L listener) {
        listeners.add(listener);
    }

    public void removeListener(L listener) {
        listeners.remove(listener);
    }
}
