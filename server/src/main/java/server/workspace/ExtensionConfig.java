package server.workspace;

import java.util.Objects;

public class ExtensionConfig {
    private Bazel bazel;

    public ExtensionConfig() {
        bazel = null;
    }

    public Bazel getBazel() {
        return bazel;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ExtensionConfig that = (ExtensionConfig) o;
        return Objects.equals(bazel, that.bazel);
    }

    @Override
    public int hashCode() {
        return Objects.hash(bazel);
    }

    public class Bazel {
        private Buildifier buildifier;
        private Java java;

        public Bazel() {
            buildifier = null;
            java = null;
        }

        public Java getJava() {
            return java;
        }

        public Buildifier getBuildifier() {
            return buildifier;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Bazel bazel = (Bazel) o;
            return Objects.equals(buildifier, bazel.buildifier) &&
                    Objects.equals(java, bazel.java);
        }

        @Override
        public int hashCode() {
            return Objects.hash(buildifier, java);
        }
    }

    public class Buildifier {
        private String executable;
        private Boolean fixOnFormat;

        public Buildifier() {
            executable = null;
            fixOnFormat = null;
        }

        public String getExecutable() {
            return executable;
        }

        public Boolean getFixOnFormat() {
            return fixOnFormat;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Buildifier that = (Buildifier) o;
            return Objects.equals(executable, that.executable) &&
                    Objects.equals(fixOnFormat, that.fixOnFormat);
        }

        @Override
        public int hashCode() {
            return Objects.hash(executable, fixOnFormat);
        }
    }

    public class Java {
        private String home;

        public Java() {
            home = null;
        }

        public String getHome() {
            return home;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Java java = (Java) o;
            return Objects.equals(home, java.home);
        }

        @Override
        public int hashCode() {
            return Objects.hash(home);
        }
    }
}
