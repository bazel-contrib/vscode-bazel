workspace(name = "bazel_language_server")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")

#########################
## JAVA MAVEN EXTERNAL ##
#########################

RULES_JVM_EXTERNAL_TAG = "3.3"
RULES_JVM_EXTERNAL_SHA = "d85951a92c0908c80bd8551002d66cb23c3434409c814179c0ff026b53544dab"

# Download the jvm rules.
http_archive(
    name = "rules_jvm_external",
    strip_prefix = "rules_jvm_external-%s" % RULES_JVM_EXTERNAL_TAG,
    sha256 = RULES_JVM_EXTERNAL_SHA,
    url = "https://github.com/bazelbuild/rules_jvm_external/archive/%s.zip" % RULES_JVM_EXTERNAL_TAG,
)

# Load macros and repository rules.
load("@rules_jvm_external//:defs.bzl", "maven_install")

# Install maven packages.
maven_install(
    artifacts = [
        "com.google.code.gson:gson:2.8.6",
        "com.google.guava:guava:29.0-jre",
        "com.google.protobuf:protobuf-java:3.14.0",
        "junit:junit:4.12",
        "org.apache.logging.log4j:log4j-core:2.13.3",
        "org.apache.logging.log4j:log4j-api:2.13.3",
        "org.eclipse.lsp4j:org.eclipse.lsp4j:0.10.0",
        "org.eclipse.lsp4j:org.eclipse.lsp4j.jsonrpc:0.10.0",
        "org.mockito:mockito-core:3.5.15",
    ],
    repositories = [
        "https://repo1.maven.org/maven2",
        "https://jcenter.bintray.com/",
        "https://maven.google.com",
    ],
)

##########
## JAVA ##
##########

# Download the java rules.
http_archive(
    name = "rules_java",
    sha256 = "220b87d8cfabd22d1c6d8e3cdb4249abd4c93dcc152e0667db061fb1b957ee68",
    url = "https://github.com/bazelbuild/rules_java/releases/download/0.1.1/rules_java-0.1.1.tar.gz",
)

# Load macros and repository rules.
load("@rules_java//java:repositories.bzl", "rules_java_dependencies", "rules_java_toolchains")

# Declare indirect dependencies and register toolchains.
rules_java_dependencies()
rules_java_toolchains()

############
## GOLANG ##
############

# Download the Go rules.
http_archive(
    name = "io_bazel_rules_go",
    sha256 = "6f111c57fd50baf5b8ee9d63024874dd2a014b069426156c55adbf6d3d22cb7b",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/rules_go/releases/download/v0.25.0/rules_go-v0.25.0.tar.gz",
        "https://github.com/bazelbuild/rules_go/releases/download/v0.25.0/rules_go-v0.25.0.tar.gz",
    ],
)

# Download Gazelle.
http_archive(
    name = "bazel_gazelle",
    sha256 = "b85f48fa105c4403326e9525ad2b2cc437babaa6e15a3fc0b1dbab0ab064bc7c",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/bazel-gazelle/releases/download/v0.22.2/bazel-gazelle-v0.22.2.tar.gz",
        "https://github.com/bazelbuild/bazel-gazelle/releases/download/v0.22.2/bazel-gazelle-v0.22.2.tar.gz",
    ],
)

# Load macros and repository rules.
load("@io_bazel_rules_go//go:deps.bzl", "go_register_toolchains", "go_rules_dependencies")
load("@bazel_gazelle//:deps.bzl", "gazelle_dependencies", "go_repository")

# Declare Go direct dependencies.
# TODO: Add Golang dependencies here.

# Declare indirect dependencies and register toolchains.
go_rules_dependencies()
go_register_toolchains(version = "1.15.5")
gazelle_dependencies()

##############
## PROTOBUF ##
##############

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")

# Download the protobuf rules.
http_archive(
    name = "rules_proto",
    sha256 = "602e7161d9195e50246177e7c55b2f39950a9cf7366f74ed5f22fd45750cd208",
    strip_prefix = "rules_proto-97d8af4dc474595af3900dd85cb3a29ad28cc313",
    urls = [
        "https://mirror.bazel.build/github.com/bazelbuild/rules_proto/archive/97d8af4dc474595af3900dd85cb3a29ad28cc313.tar.gz",
        "https://github.com/bazelbuild/rules_proto/archive/97d8af4dc474595af3900dd85cb3a29ad28cc313.tar.gz",
    ],
)

# Load macros and repository rules.
load("@rules_proto//proto:repositories.bzl", "rules_proto_dependencies", "rules_proto_toolchains")

# Declare indirect dependencies and register toolchains.
rules_proto_dependencies()
rules_proto_toolchains()
