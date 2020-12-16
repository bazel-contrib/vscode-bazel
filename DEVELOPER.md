# For Developers

This document has some how-to's for this repo as well as some helpful information about how this repo works.

## Overview

This repo has multiple projects inside of it, including extension clients and a language server. The repo has been dockerized, you may open the project from within VSCode inside of the provided `.devcontainer` for the most consistent developer experience.

## Environment setup

As mentioned before, for the best experience, open up this project within VSCode inside of the provided `.devcontainer`. To develop the project's server code, consider using a project like IntelliJ (make sure you have the bazel extension installed). From there, open up this project using the existing BUILD file bazel configuration. That should give you intellisense for running the project within IntelliJ.

## Running the projects

Much of the project uses bazel as the build tool (we're working on migrating everything over to bazel as we get the time).

**VSCode extension client**

Use the provided shell script to build the VSCode client (see below). Alternatively, since the VScode client is built for VSCode, you may open this project in VSCode and press `f5` to build and run the development extension host (reccommended).

```
scripts/build.sh -n client_vscode
```

When you're ready to run the VSCode client test suite to ensure everything is working, use the provided test shell script (see below). This will run the VSCode client's unit tests.

> Note: Integration tests are not currently supported for the VSCode client.

```
scripts/test.sh -n client_vscode
```

**Language server**

Use the provided shell script to build the language server.

```
scripts/build.sh -n server
```

When you're ready to run the server test suite to ensure everything is working, use the provided test shell script (see below). This will test the server using bazel's test cli.

```
scripts/test.sh -n server
```

## Helpful resources

Protocol buffers

- [Protocol Buffers in Bazel](https://blog.bazel.build/2017/02/27/protocol-buffers.html)
- [Cross-language API schemas with Bazel](https://blog.nrwl.io/cross-language-api-schemas-with-bazel-eff0f498ce0d)

## Helpful BUILD rules

Load statements

```
load("@io_bazel_rules_go//go:def.bzl", "go_binary", "go_library", "go_test")
load("@rules_java//java:defs.bzl", "java_proto_library")
load("@io_bazel_rules_go//proto:def.bzl", "go_proto_library")
```

## Helpful commands

Some helpful commands that can be used to debug this bazel project.

### Query for a rule

To query for a specific rule being used in a package (and any of its sub-folders), use bazel's query function. This will display a list of rules matching the specified kind.

```
bazel query 'kind(java_library, //server/...)'
```

### Query for WORKSPACE packages

To query for all packages listed in some workspace (e.g. maven), use the bazel query command and specify the workspace to look into. This is helpful for tracking down and copying the bazel targets at a specific location.

```
bazel query @maven//...
```

### List classes in a jar file

To get a list of java packages present within a jar package (e.g bazel_ls_deploy.jar), use the jar tool.

```
jar tvf bazel-bin/server/src/main/java/server/bazel_ls_deploy.jar
```

Or pipe the results into grep to query for a specific path.

```
jar tvf bazel-bin/server/src/main/java/server/bazel_ls_deploy.jar | grep BazelLanguageServer
```
