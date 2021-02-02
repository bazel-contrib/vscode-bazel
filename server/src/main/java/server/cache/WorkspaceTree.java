package server.cache;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class WorkspaceTree<T> {
    private Node<T> root;

    public WorkspaceTree(T rootValue) {
        this.root = new Node<>(rootValue, null);
    }

    public Node<T> getRoot() {
        return this.root;
    }

    public static class Node<T> {
        private Node<T> parent;
        private T value;
        private List<Node<T>> children;

        public Node(T value, Node<T> parent) {
            this.parent = parent;
            this.value = value;
            this.children = new ArrayList<>();
        }

        public T getValue() {
            return value;
        }

        public Node<T> addChild(T value) {
            Node<T> child = new Node<>(value, this);
            this.children.add(child);
            return child;
        }

        public Optional<Node<T>> getChild(T childValue) {
            for(Node<T> node : children) {
                if(node.equals(childValue)) {
                    return Optional.of(node);
                }
            }
            return Optional.empty();
        }

        public boolean isRoot() {
            return this.parent == null;
        }

        public boolean isLeaf() {
            return this.children.isEmpty();
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Node<?> node = (Node<?>) o;
            return Objects.equals(value, node.value);
        }

        @Override
        public int hashCode() {
            return Objects.hash(parent, value, children);
        }
    }
}
