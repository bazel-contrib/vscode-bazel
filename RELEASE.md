# Releasing

Most of the releasing is done by [release please](https://github.com/googleapis/release-please), but there are still some manual steps required.

## Create and Test the .vsix Package

Check out the branch of the auto-generated release PR and, run the following command from the directory of the extension source code:

```
$ npm run package
```

This will compile and bundle the extension into a file named `vscode-bazel-x.y.z.vsix`, where `x.y.z` is the version number of the extension as defined in `package.json`.

Having this standalone package available before uploading the release to the Marketplace or to GitHub is useful for testing:

- Install it manually by running the following command:

  ```
  $ code --install-extension vscode-bazel-x.y.z.vsix
  ```

- Verify that everything works as intended in a deployment environment rather than a development environment. (For example, you can check that you haven't [accidentally listed dependencies you need at runtime as `devDependencies`](https://github.com/bazelbuild/vscode-bazel/issues/14).)

Once you're confident that the release works, deploy it using the steps below.

## Deploy the Release

To deploy the release, merge the auto-generated release PR. This will contain a changelog and version bump. Upon merging, this will create a github release & git tag. However, there are still some manual steps required to deploy the extension.

We deploy the extension to **two** destinations:

1. We create a .vsix package to upload as a GitHub release, since this is a useful archiving method and it allows users to download and roll back to a previous version of the plugin if necessary. This is automated by the "Build VS Code extension" GitHub action which will automatically run as soon as a new GitHub release gets created.
2. We publish the extension to the Visual Studio Marketplace so that it can be found in search results and downloaded from Visual Studio Code's Extensions area. This is a manual step and requires publishing rights for the Bazel organization on the Visual Studio Marketplace. Florian Weikert <fwe@google.com> has handled recent versions.
