# Protobufs

This directory contains `.proto` files needed to communicate with other services that provide features needed by the Bazel Language Server. Some of the `.proto` files are curated in-house. Others are vendored from a 3rd party source.

## Vendored Protos

The `vendored.txt` file in this directory lists the paths of the `.proto` files that should be downloaded and built. If new protos are introduced (or if some are removed), then you should update this list. Many of these protobufs are taken from the [bazelbuild/bazel](https://github.com/bazelbuild/bazel) repository so that the server does not need to directly depend on the repository's source code.

An important note about the vendored files: The directory structure herein mimics that in the original repo, which is necessary for the imports among `.proto` files to work correctly. That being said, don't attempt to move around or modify any of the generated `.proto` files. Those changes will be overriden after the next sync.

To download new copies of the vendored `.proto` files, execute the `proto_sync.sh` script in the scripts folder of this repository.

```
./scripts/proto_sync.sh -n server
```
