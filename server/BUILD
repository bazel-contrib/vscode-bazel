load("@rules_java//java:defs.bzl", "java_binary", "java_library", "java_test")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "server",
    srcs = glob([
        "src/main/java/**/*.java",
    ]),
    resources = glob([
        "src/main/resources/**",
    ]),
    deps = [
        "//third_party/java:log4j",
        "//third_party/java:lsp4j",
        "//third_party/java:guava",
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
        "//third_party/java:gson",
        "//third_party/java:guava",
        "//third_party/java:junit",
        "//third_party/java:lsp4j",
        "//third_party/java:mockito",
    ],
)
