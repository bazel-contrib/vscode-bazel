load("@bazel_tools//tools/build_defs/repo:http.bzl", "http_file")

def _bazel_protos_impl(module_ctx):
    ref = None
    for module in module_ctx.modules:
        for version in module.tags.version:
            ref = version.ref

    if ref == None:
        fail("You must specify a bazel version for downloading protos")

    for module in module_ctx.modules:
        for proto in module.tags.proto:
            _, name = proto.path.rsplit("/", 1)
            name = name.replace(".", "_")
            http_file(
                name = name,
                url = "https://raw.githubusercontent.com/bazelbuild/bazel/{}/{}".format(ref, proto.path),
                integrity = proto.integrity,
            )

_proto = tag_class(attrs = {"path": attr.string(mandatory = True), "integrity": attr.string(mandatory = True)})
_version = tag_class(attrs = {"ref": attr.string(mandatory = True)})
bazel_protos = module_extension(
    implementation = _bazel_protos_impl,
    tag_classes = {"proto": _proto, "version": _version},
)
