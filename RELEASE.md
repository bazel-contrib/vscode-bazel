# One-Time Setup

Make sure you have the `vsce` tool installed:

```
$ npm install -g vsce
```

# Prepare a Release

Once you have the code in the state that you want to release, make sure you've done the following:

- Bump the version number in the `version` key of `package.json`.
- Add a new section to CHANGELOG.md denoting the new release and any updates you wish to call out. This content is presented to users in the VS Code Extensions UI.
- Tag the commit with the version number of the release:

  ```
  $ git tag x.y.z
  ```

  (This step is optional; you can also do it as part of the GitHub release. See below.)

- Push these changes (including the tag) to GitHub.

# Create and Test the .vsix Package

From the directory containing the extension source code, run the following command:

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

# Deploy the Release

We deploy the extension to **two** destinations:

1. We create a .vsix package to upload as a GitHub release, since this is a useful archiving method and it allows users to download and roll back to a previous version of the plugin if necessary.
2. We publish the extension to the Visual Studio Marketplace so that it can be found in search results and downloaded from Visual Studio Code's Extensions area.

# Creating a GitHub Release

1. On the vscode-bazel Releases page, select **Draft a New Release**.
2. Fill out the form as follows:
   1. **Tag version**: Enter the version number of the release (in the format `x.y.z`). If you create this tag earlier (see Preparing a Release, above), that tag will be used; otherwise, it will be created for you.
   2. **Release title**: Enter the version number and release date (for example, `x.y.z (November 28, 2018)`).
   3. **Describe this release**: Paste the information you wrote about this version from CHANGELOG.md into this text area.
3. Attach the `vscode-bazel-x.y.z.vsix` file to the release by dragging it or selecting it in the upload box.
4. Once you're ready for it to be public, click **Publish release**.

You can now delete the .vsix file if you wish; it will not be used when publishing to the marketplace.
