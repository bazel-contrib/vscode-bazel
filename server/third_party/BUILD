load("@rules_java//java:defs.bzl", "java_library", "java_import")

package(default_visibility = ["//visibility:public"])

# TODO: Just depend on the maven third party

# NOTE: 
# Find jvm_import
# Bazel query: bazel query @maven//:org_eclipse_lsp4j_org_eclipse_lsp4j --output=build

###########################
## MAVEN - JAVA PACKAGES ##
###########################

java_library(
    name = "gson",
    exports = [
        "@maven//:com_google_code_gson_gson",
    ],
)

java_library(
    name = "guava",
    exports = [
        "@maven//:com_google_guava_guava",
    ],
)

java_library(
    name = "junit",
    exports = [
        "@maven//:junit_junit",
    ],
)

java_library(
    name = "log4j",
    exports = [
        "@maven//:org_apache_logging_log4j_log4j_core",
        "@maven//:org_apache_logging_log4j_log4j_api",
    ],
)

java_library(
    name = "lsp4j",
    exports = [
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_debug",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_jsonrpc",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_jsonrpc_debug",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_generator",
        "@maven//:org_eclipse_lsp4j_org_eclipse_lsp4j_websocket",
    ],
)

java_library(
    name = "mockito",
    exports = [
        "@maven//:org_mockito_mockito_core",
        "@maven//:org_mockito_mockito_junit_jupiter",
    ],
)

#######################################
## BAZELBUILD - JAVA STARLARK PARSER ##
#######################################

java_import(
    name = "starlark",
    jars = [
        "starlark/starlark_api_deploy.jar",
    ],
)
