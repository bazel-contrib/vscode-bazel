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

## Setting up your development environment

To contribute, you likely should already be familiar with VS Code extensions.
The best place to start is probably their
[guide](https://code.visualstudio.com/api/get-started/your-first-extension).

Once somewhat familiar with the process, you just need to check out this
project, do an `npm install` to get the required packages into the local
checkout's _node_modules_ and then open the directory in VS Code. There are
already tasks configured to build/debug the extension. Note: having the released
version of this extension install what trying to work on it can some times
confuse things, so it is usually best to not have the release version installed
at the same time.

To enforce a consistent code style through our code base, we have configured
the project to use **prettier** and **eslint** to perform formatting and
linting. We strongly recommend installing the following Visual Studio Code
extensions to have these tools applied automatically as you develop:

- [Prettier - Code Formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

## Testing

We expect contributions to include tests that demonstrate and validate the intended behavior.

- Running tests: Use `npm run test` to run the tests. These tests will download a local version of vscode into the `.vscode-test` directory and will run integration tests against the extension in that workspace.

- New features: add a set of VS Code integration tests that demo the intended behaviour by making use of the mock workspace under `test/bazel_workspace` (vscode-tests will be executed within this workspace). Integration tests should exercise the extension as a user would (for example: open editors, execute commands with `vscode.commands.executeCommand`, and assert on the editor state or extension outputs). See `test/go_to_label.test.ts` for a minimal integration-style example.

- Utilities and bug fixes: extend the existing unit tests. If you add a new util or fix an existing one, include unit tests that cover the happy path and at least one edge case. See `test/code_lens_provider.test.ts` for a unit-style example.

- Note: If you are getting test failures from files that no longer exist, try running `npm run clean` to clean the workspaceand then `npm install && npm run test` again.

## Commit messages

Commit messages should follow the [Conventional Commit message](https://www.conventionalcommits.org/)
conventions. The [`release-please`](https://github.com/google-github-actions/release-please-action)
Github action relies on those commit messages to automatically generate the
release notes. See the [list of supported commit types](https://github.com/googleapis/release-please/blob/main/src/changelog-notes.ts#L43).

## Code reviews

All submissions, including submissions by project members, require review. We
use GitHub pull requests for this purpose. Consult
[GitHub Help](https://help.github.com/articles/about-pull-requests/) for more
information on using pull requests.

## Community Guidelines

This project follows [Google's Open Source Community
Guidelines](https://opensource.google.com/conduct/).
