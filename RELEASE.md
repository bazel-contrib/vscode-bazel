# Releasing

Most of the releasing is done by [release please](https://github.com/googleapis/release-please), but there are still some manual steps required.

## One-Time Setup

Make sure you have the `vsce` tool installed:

```
$ npm install -g vsce
```

## Create and Test the .vsix Package

Check out the branch of the auto-generated release PR and, run the following command from the directory of the extension source code:

```
$ vsce package
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

1. We create a .vsix package to upload as a GitHub release, since this is a useful archiving method and it allows users to download and roll back to a previous version of the plugin if necessary. This can be done by anyone who is a maintainer on GitHub. This is done by attaching the `vscode-bazel-x.y.z.vsix` file to the auto-generated release by dragging it or selecting it in the upload box.
2. We publish the extension to the Visual Studio Marketplace so that it can be found in search results and downloaded from Visual Studio Code's Extensions area. This requires publishing rights for the Bazel organization on the Visual Studio Marketplace. Florian Weikert <fwe@google.com> has handled recent versions.

You can now delete the .vsix file if you wish; it will not be used when publishing to the marketplace.
