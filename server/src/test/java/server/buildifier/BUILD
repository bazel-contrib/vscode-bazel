load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "buildifier",
    srcs = [
        "BuildifierTest.java",
    ],
    deps = [
        "//server/src/main/java/server/buildifier:buildifier",
        "//server/src/main/java/server/utils:utils",
        "//server/src/main/java/server/workspace:workspace",
        "//third_party/java:guava",
        "//third_party/java:jmifs",
        "//third_party/java:junit",
        "//third_party/java:mockito",
        "@maven//:com_google_code_gson_gson",
    ],
)
