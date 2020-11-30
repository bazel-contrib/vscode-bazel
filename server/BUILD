load("@rules_java//java:defs.bzl", "java_binary", "java_library", "java_test")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "root",
    srcs = glob([
        "src/main/java/**/*.java",
    ]),
    resources = glob([
        "src/main/resources/**",
    ]),
    deps = [
        "@bazel//src/main/java/net/starlark/java/syntax:syntax",

        "@maven//:com_google_guava_guava",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_jsonrpc",
        "@maven//:org_apache_logging_log4j_log4j_core",
        "@maven//:org_apache_logging_log4j_log4j_api",
    ],
)

java_binary(
    name = "bazel_ls",
    main_class = "server.BazelLanguageServer",
    runtime_deps = [
        "//:root",
    ],
)

java_test(
    name = "bazel_ls_test",
    srcs = glob(["src/test/java/**/*.java"]),
    test_class = "AllTests",
    deps = [
        "//:root",

        "@maven//:com_google_guava_guava",

        "@maven//:junit_junit",

        "@maven//:org_mockito_mockito_core",
        "@maven//:org_mockito_mockito_junit_jupiter",

        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_jsonrpc",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_jsonrpc_debug",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_generator",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_websocket",

        "@maven//:org_apache_logging_log4j_log4j_core",
        "@maven//:org_apache_logging_log4j_log4j_api",
    ],
)
