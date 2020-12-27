load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "server",
    srcs = [
        "BazelServicesTest.java",
    ],
    deps = [
        "//server/src/main/java/server:server",
        "//third_party/java:guava",
        "//third_party/java:junit",
        "//third_party/java:lsp4j",
        "//third_party/java:mockito",
    ],
)
