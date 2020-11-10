load("@rules_cc//cc:defs.bzl", "cc_binary")

cc_binary(
    name = "main",
    srcs = ["main.cc"],
    
    # Add libraries from the `external_local_repo` as dependencies
    # for this build.
    deps = [
        "@my_external_local_repo//formatter:all_formatters",
        "@my_external_local_repo//logger:logger",
    ],
)
