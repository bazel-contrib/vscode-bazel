package server.bazel.cli;

import org.junit.Test;

public class BazelTest {

    @Test
    public void getBuildTargets() {
        try {
            Bazel.getBuildTargets();
        } catch (BazelServerException e) {
            System.out.println(e.getMessage());
        }
    }
}