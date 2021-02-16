load("@rules_java//java:defs.bzl", "java_library")

package(default_visibility = ["//visibility:public"])

java_library(
    name = "dispatcher",
    srcs = [
        "CommandDispatcher.java",
        "CommandOutput.java",
        "Executable.java",
        "ICommand.java",
        "SyncPipe.java",
    ],
    deps = [
        "//server/src/main/java/server/utils",
        "//third_party/java:guava",
        "//third_party/java:log4j",
    ],
)
