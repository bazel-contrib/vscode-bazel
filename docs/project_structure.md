# Project Structure

This project is a monorepo which houses multiple client extensions to one Bazel language server. The repo has been dockerized, you may open the project from within VSCode inside of the provided `.devcontainer` for the most consistent developer experience.

## Environment Setup

As mentioned before, for the best experience, open up this project within VSCode inside of the provided `.devcontainer`. To develop the project's server code, consider using a project like IntelliJ (make sure you have the Bazel extension installed). From there, open up this project using the existing BUILD file Bazel configuration. That should give you intellisense for running the project within IntelliJ.

## Compile and Test the Projects

Much of the project uses Bazel as the build tool (we're working on migrating everything over to Bazel as we get the time).

**VSCode extension client**

Use the provided shell script to build the VSCode client (see below). Alternatively, since the VScode client is built for VSCode, you may open this project in VSCode and press `f5` to build and run the development extension host (reccommended). To build the VSCode client from the command line, use the following command.

```
scripts/build.sh -n client_vscode
```

When you're ready to run the VSCode client test suite to ensure everything is working, use the provided test shell script (see below). This will run the VSCode client's unit tests.

> Note: Integration tests are not currently supported for the VSCode client.

```
scripts/test.sh -n client_vscode
```

**Language server**

Use the provided shell script to build the language server. This will compile the server as a deployable jar. It will save it to the `bazel-bin` folder.

```
scripts/build.sh -n server
```

When you're ready to run the server test suite to ensure everything is working, use the provided test shell script (see below). This will test the server using Bazel's test cli.

```
scripts/test.sh -n server
```
