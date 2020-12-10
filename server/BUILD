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
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_jsonrpc",
        "@maven//:org_apache_logging_log4j_log4j_core",
        "@maven//:org_apache_logging_log4j_log4j_api",
        "@maven//:com_google_guava_guava",
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
        "@maven//:com_google_guava_guava",
        "@maven//:junit_junit",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_jsonrpc",
        "@maven//:org_mockito_mockito_core",
    ],
)
