# How to Contribute

We'd love to accept your patches and contributions to this project. There are
just a few small guidelines you need to follow.

## File or claim an issue

Please let us know what you're working on if you want to change or add to the
Bazel Visual Studio Code extension.

Before undertaking to write something new for the extension, please file an
issue or claim an existing issue. All significant changes to the extension must
be discussed before they can be accepted. This gives all participants a chance
to validate the design and to avoid duplication of effort.

## Contributor License Agreement

Contributions to this project must be accompanied by a Contributor License
Agreement. You (or your employer) retain the copyright to your contribution;
this simply gives us permission to use and redistribute your contributions as
part of the project. Head over to <https://cla.developers.google.com/> to see
your current agreements on file or to sign a new one.

You generally only need to submit a CLA once, so if you've already submitted one
(even if it was for a different project), you probably don't need to do it
again.

## Setting up your development environment

To contribute, you likely should already be familiar with VSCode extensions.
The best place to start is probably their
[guide](https://code.visualstudio.com/api/get-started/your-first-extension).

Once somewhat familiar with the process, you just need to check out this
project, do an `npm install` to get the required packages into the local
checkout's *node_modules* and then open the directory in VS Code. There are
already tasks configured to build/debug the extension. Note: having the released
version of this extension install what trying to work on it can some times
confuse things, so it is usually best to not have the release version installed
at the same time.

To enforce a consistent code style through our code base, we have configured
the project to use **prettier** and **tslint** to perform formatting and
linting. We strongly recommend installing the following Visual Studio Code
extensions to have these tools applied automatically as you develop:

- [Prettier - Code Formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [TSLint](https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-typescript-tslint-plugin)

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Community Guidelines

This project follows [Google's Open Source Community
Guidelines](https://opensource.google.com/conduct/).
