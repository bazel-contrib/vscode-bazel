package server.workspace;

/**
 * The extension configuration. This will reflect the configuration that is
 * expected from the client. Each client's configuration should mirror this
 * object.
 */
public class ExtensionConfig {
    private Bazel bazel;

    public ExtensionConfig() {
        bazel = null;
    }

    public Bazel getBazel() {
        return bazel;
    }

    public void setBazel(Bazel bazel) {
        this.bazel = bazel;
    }

    /**
     * The Bazel configuration.
     */
    public static class Bazel {
        private Buildifier buildifier;
        private Java java;

        public Bazel() {
            buildifier = null;
            java = null;
        }

        public Buildifier getBuildifier() {
            return buildifier;
        }

        public void setBuildifier(Buildifier buildifier) {
            this.buildifier = buildifier;
        }

        public Java getJava() {
            return java;
        }

        public void setJava(Java java) {
            this.java = java;
        }
    }

    /**
     * The Buildifier configuration.
     */
    public static class Buildifier {
        private String executable;
        private Boolean fixOnFormat;

        public Buildifier() {
            executable = null;
            fixOnFormat = null;
        }

        public String getExecutable() {
            return executable;
        }

        public void setExecutable(String executable) {
            this.executable = executable;
        }

        public Boolean getFixOnFormat() {
            return fixOnFormat;
        }

        public void setFixOnFormat(Boolean fixOnFormat) {
            this.fixOnFormat = fixOnFormat;
        }
    }

    /**
     * The java configuration.
     */
    public static class Java {
        private String home;

        public Java() {
            home = null;
        }

        public String getHome() {
            return home;
        }

        public void setHome(String home) {
            this.home = home;
        }
    }
}
