workspace(name = "bazel_language_server")

load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_archive")
load("@bazel_tools//tools/build_defs/repo:git.bzl", "git_repository")

RULES_JVM_EXTERNAL_TAG = "3.3"
RULES_JVM_EXTERNAL_SHA = "d85951a92c0908c80bd8551002d66cb23c3434409c814179c0ff026b53544dab"

http_archive(
    name = "rules_jvm_external",
    strip_prefix = "rules_jvm_external-%s" % RULES_JVM_EXTERNAL_TAG,
    sha256 = RULES_JVM_EXTERNAL_SHA,
    url = "https://github.com/bazelbuild/rules_jvm_external/archive/%s.zip" % RULES_JVM_EXTERNAL_TAG,
)

load("@rules_jvm_external//:defs.bzl", "maven_install")

maven_install(
    artifacts = [
        # Gson
        "com.google.code.gson:gson:2.8.6",

        # Guava
        "com.google.guava:guava:29.0-jre",

        # JUnit
        "junit:junit:4.12",

        # Mockito
        "org.mockito:mockito-core:3.5.15",
        "org.mockito:mockito-junit-jupiter:3.5.15",

        # LSP
        "org.eclipse.lsp4j:org.eclipse.lsp4j:0.10.0",
        "org.eclipse.lsp4j:org.eclipse.lsp4j.debug:0.10.0",
        "org.eclipse.lsp4j:org.eclipse.lsp4j.jsonrpc:0.10.0",
        "org.eclipse.lsp4j:org.eclipse.lsp4j.jsonrpc.debug:0.10.0",
        "org.eclipse.lsp4j:org.eclipse.lsp4j.generator:0.10.0",
        "org.eclipse.lsp4j:org.eclipse.lsp4j.websocket:0.10.0",

        # Logging
        "org.apache.logging.log4j:log4j-core:2.13.3",
        "org.apache.logging.log4j:log4j-api:2.13.3",
    ],
    repositories = [
        "https://repo1.maven.org/maven2",
        "https://jcenter.bintray.com/",
        "https://maven.google.com",
    ],
)

git_repository(
    name = "bazel",
    remote = "https://github.com/bazelbuild/bazel.git",
    # Commit: "starlark resolver: implement "flat globals" optimization"
    commit = "8974ba2518603710c9e602d6d8518b7494eadc09",
)
