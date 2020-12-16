load("@rules_java//java:defs.bzl", "java_binary", "java_library")

package(default_visibility = ["//visibility:public"])

java_binary(
    name = "external",
    main_class = "external.Main",
    srcs = [
        "Main.java",
    ],
    deps = [
        "//third_party/java:protobuf",
        "//server/src/main/java/external/starlark:syntax_lib",
    ],
)
