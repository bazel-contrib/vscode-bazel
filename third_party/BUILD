load("@rules_java//java:defs.bzl", "java_import")

package(default_visibility = ["//visibility:public"])

# TODO (josiahsrc): Once the starlark becomes publically available, use
# that import instead of the raw jar. This will allow this code to be
# up-to-date with the remote repo.
java_import(
    name = "starlark",
    jars = [
        "starlark/starlark_api_deploy.jar",
    ],
)
