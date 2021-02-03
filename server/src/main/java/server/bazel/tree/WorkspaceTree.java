package server.bazel.tree;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public class WorkspaceTree {
    private Node root;

    public WorkspaceTree(Package rootPackage) {
        this.root = new Node(rootPackage, null);
    }

    public Node getRoot() {
        return this.root;
    }

    public static class Node {
        private Node parent;
        private Package value;
        private List<Node> children;

        public Node(Package value, Node parent) {
            this.parent = parent;
            this.value = value;
            this.children = new ArrayList<>();
        }

        public Package getValue() {
            return value;
        }

        public Node addChild(Package value) {
            Node child = new Node(value, this);
            this.children.add(child);
            return child;
        }

        public Optional<Node> getChild(Package childValue) {
            for(Node node : children) {
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
            Node node = (Node) o;
            return Objects.equals(value, node.value);
        }

        @Override
        public int hashCode() {
            return Objects.hash(parent, value, children);
        }
    }
}
