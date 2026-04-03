# Causes an unused assignment linting error.
_foo = ""

sh_binary(
    name = "buildifier",
    srcs = ["buildifier_good"],
    visibility = ["//visibility:public"],
)

sh_binary(
    name = "buildifier_outdated",
    srcs = ["buildifier_old"],
    visibility = ["//visibility:public"],
)
