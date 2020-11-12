load("@rules_cc//cc:defs.bzl", "cc_binary", "cc_library")

cc_library(
    name = "all_formatters",
    srcs = ["format_lower_case.cc", "format_upper_case.cc"],
    hdrs = ["format_lower_case.hh", "format_upper_case.hh"],
    visibility = ["//visibility:public"],
)

cc_library(
    name = "lower_formatters",
    srcs = ["format_lower_case.cc"],
    hdrs = ["format_lower_case.hh"],
    visibility = ["//visibility:public"],
)

cc_library(
    name = "upper_formatters",
    srcs = ["format_upper_case.cc"],
    hdrs = ["format_upper_case.hh"],
    visibility = ["//visibility:public"],
)
