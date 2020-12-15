load("@rules_java//java:defs.bzl", "java_import")

package(default_visibility = ["//visibility:public"])

# LICENSE: Apache License 2.0
java_library(
    name = "guava",
    exports = [
        "@maven//:com_google_guava_guava",
    ],
)

# LICENSE: EPL
java_library(
    name = "junit",
    exports = [
        "@maven//:junit_junit",
    ],
)

# LICENSE: EPL
java_library(
    name = "log4j",
    exports = [
        "@maven//:org_apache_logging_log4j_log4j_core",
        "@maven//:org_apache_logging_log4j_log4j_api",
    ],
)

# LICENSE: EPL
java_library(
    name = "lsp4j",
    exports = [
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_jsonrpc",
    ],
)

# LICENSE: MIT
java_library(
    name = "mockito",
    exports = [
        "@maven//:org_mockito_mockito_core",
    ],
)

# TODO (josiahsrc): Once the starlark becomes publically available, use
# that import instead of the raw jar. This will allow this code to be
# up-to-date with the remote repo.
java_import(
    name = "starlark",
    jars = [
        "starlark/starlark_api_deploy.jar",
    ],
)
