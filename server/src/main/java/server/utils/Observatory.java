package server.utils;

import java.util.HashSet;
import java.util.Set;

public class Observatory<L> {
    private Set<L> listeners = new HashSet<>();

    public void notifyListeners(Callbacks.Consumer<L> callback) {
        for (L listener : listeners) {
            callback.invoke(listener);
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
