# CPP Example - External Dependencies

This project provides an example of external dependencies in bazel (e.g. depending on files from a completely different project). Read more about external dependencies [here](https://docs.bazel.build/versions/master/external.html).

## Setup

The `external_local_repo` is the external depencies of the `main_repo` in the case of this example.

### Main Repo

The `WORKSPACE` file in this example creates a dependency on the `external_local_repo`.

The `BUILD` file in the `main_repo/src/BUILD` uses the `@my_external_local_repo//formatter:all_formatters`, statement to import files from the `external_local_repo`.

### External Local Repo

This folder has some shared code which is used by other bazel workspaces (`WORKSPACE`). There are two package in this library:

1. formatter - Provides some functions to format strings.
2. logger - Provides some very basic methods to log errors, info, and warnings.

The `BUILD` file for each of these packages provides named `cc_libraries` which can be imported by other bazel workspaces.
