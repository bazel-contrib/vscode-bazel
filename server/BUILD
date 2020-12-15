load("@rules_java//java:defs.bzl", "java_binary", "java_library", "java_test")

package(default_visibility = ["//visibility:public"])

alias(
    name = "build",
    actual = ":bazel_ls_deploy.jar",
)

java_library(
    name = "server",
    srcs = glob([
        "src/main/java/**/*.java",
    ]),
    resources = glob([
        "src/main/resources/**",
    ]),
    deps = [
        "//third_party:lsp4j",
        "//third_party:log4j",
        "//third_party:guava",
        "//third_party:starlark",
    ],
)

java_binary(
    name = "bazel_ls",
    main_class = "server.BazelLanguageServer",
    runtime_deps = [
        ":server",
    ],
)

java_test(
    name = "test",
    srcs = glob(["src/test/java/**/*.java"]),
    test_class = "AllTests",
    deps = [
        ":server",
        "//third_party:guava",
        "//third_party:junit",
        "//third_party:lsp4j",
        "//third_party:mockito",
    ],
)
