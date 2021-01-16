load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "starlark",
    srcs = [
        "ParseException.java",
        "ParseInput.java",
        "ParseOutput.java",
        "StarlarkFacade.java",
    ],
    deps = [
        "//third_party/java:guava",
        "//third_party/java:log4j",
        "//third_party/java:starlark",
    ],
)
