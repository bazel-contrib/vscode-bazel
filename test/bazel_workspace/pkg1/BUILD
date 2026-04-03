# Note this file contains different kinds of labels on purpose - used by copy_label_to_clipboard test
load("@local_config_platform//:constraints.bzl", "HOST_CONSTRAINTS")  # external label
py_library(
    name="pkg1",  # Same label as package
    srcs=glob(["subfolder/*.py"]),
    imports=["subfolder"],
)
filegroup(
    name="src_files",
    srcs=["main.py"],  # relative file label
)
py_binary(
    name="main",  # name label
    srcs=[":src_files"],  # relative target label
    visibility=["//visibility:public"],  # Full label on purpose
    deps=["//pkg1"],  # Short package label on purpose
)
filegroup(
    name="foo",
    srcs=["subfolder/foo.txt"],
)