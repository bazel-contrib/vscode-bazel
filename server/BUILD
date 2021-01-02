load("@rules_java//java:defs.bzl", "java_binary", "java_library", "java_test")

package(default_visibility = ["//visibility:public"])

alias(
    name = "build",
    actual = ":bazel_ls_deploy.jar",
)

alias(
    name = "server_deploy.jar",
    actual = ":bazel_ls_deploy.jar",
)

alias(
    name = "server",
    actual = ":bazel_ls",
)

java_binary(
    name = "bazel_ls",
    main_class = "server.BazelLanguageServer",
    runtime_deps = [
        "//server/src/main/java/server:server",
    ],
    resources = [
        "//server/src/main/resources:all",
    ],
)

alias(
    name = "server_test",
    actual = ":test",
)

java_test(
    name = "test",
    test_class = "AllServerTests",
    runtime_deps = [
        "//server/src/test/java/server:server",
    ],
)
