# For Developers

This document has some how-to's for this repo as well as some helpful information about how this repo works.

## Overview

This repo has multiple projects inside of it, including extension clients and a language server. The repo has been dockerized, you may open the project from within VSCode inside of the provided `.devcontainer` for the most consistent developer experience.

## Building the projects

## Helpful bazel commands

To query for a specific rule being used in a package (and any of its sub-folders), use bazel's query function. This will display a list of rules matching the specified kind.

```
bazel query 'kind(java_library, //server/...)'
```

To query for all packages listed in some workspace (e.g. maven), use the bazel query command and specify the workspace to look into. This is helpful for tracking down and copying the bazel targets at a specific location.

```
bazel query @maven//...
```
