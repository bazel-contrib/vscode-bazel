# Vendored protocol buffers from Bazel

This directory contains vendored `.proto` files from Bazel so that this
extension does not need to directly depend on the Bazel GitHub repository.

The directory structure herein mimics that in the original repo, which is
necessary for the imports among `.proto` files to work correctly.

## The protos_list.txt file

The `protos_list.txt` file in this directory lists the paths of the `.proto`
files that should be downloaded and built. If new protos are introduced (or
if some are removed), then update this list.

To download new copies of the vendored `.proto` files, execute the
`update_protos.sh` script in the scripts` folder of this repository.
