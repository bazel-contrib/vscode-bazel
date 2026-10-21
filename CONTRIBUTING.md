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

The extension is built, tested and packaged with [Bazel](https://bazel.build).
Install [bazelisk](https://github.com/bazelbuild/bazelisk) as `bazel`; it picks
the Bazel version from `.bazelversion`, and Bazel in turn downloads Node.js,
pnpm and all npm dependencies, so nothing else needs to be installed. Then, in
a checkout:

```
$ bazel run //:build
```

This writes the compiled extension to `dist/`, the generated grammar to
`syntaxes/`, and links `node_modules/` to the packages Bazel installed, which
is what VS Code's launch configurations (F5), the Extension Test Runner and
the TypeScript language service expect to find. Re-run it after changing
code; the default build task (`Ctrl+Shift+B`) does the same.

The familiar npm scripts (`npm run build`, `npm test`, `npm run package`, ...)
still exist, but they only forward to Bazel.

Note: having the released version of this extension installed while trying to
work on it can some times confuse things, so it is usually best to not have the
release version installed at the same time. `bazel run //:install` installs
your build into VS Code.

To enforce a consistent code style through our code base, we have configured
the project to use **prettier** and **eslint** to perform formatting and
linting. We strongly recommend installing the following Visual Studio Code
extensions to have these tools applied automatically as you develop:

- [Prettier - Code Formatter](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)

`bazel run //:format_fix` and `bazel run //:lint_fix` apply both from the
command line; `bazel test //:format //:lint` check.

### Dependencies

`package.json` and `pnpm-lock.yaml` define the npm dependencies. After editing
`package.json`, refresh the lockfile and commit both:

```
$ bazel run //:pnpm -- install --lockfile-only
```

Node.js, pnpm and TypeScript versions come from `.nvmrc`, the `packageManager`
field and `devDependencies.typescript` respectively; Renovate keeps them and
the Bazel modules in `MODULE.bazel` up to date.

## Testing

We expect contributions to include tests that demonstrate and validate the intended behavior.

- Running tests: `bazel test //...` typechecks, lints and format-checks the sources, checks the grammar snapshot and runs the VS Code integration tests. The integration tests download a VS Code build (into `~/.cache/vscode-bazel/vscode-test`) and run against the extension in the `test/bazel_workspace` fixture. They need a display (use `xvfb-run -a bazel test //...` on a headless Linux machine) and `bazel`, `buildifier`, `c++filt` and `rustfilt` on `PATH`. The Extension Test Runner in VS Code and the "Launch Extension Tests" configuration run the same tests from `dist/` after `bazel run //:build`.

- New features: add a set of VS Code integration tests that demo the intended behaviour by making use of the mock workspace under `test/bazel_workspace` (vscode-tests will be executed within this workspace). Integration tests should exercise the extension as a user would (for example: open editors, execute commands with `vscode.commands.executeCommand`, and assert on the editor state or extension outputs). See `test/go_to_label.test.ts` for a minimal integration-style example.

- Utilities and bug fixes: extend the existing unit tests. If you add a new util or fix an existing one, include unit tests that cover the happy path and at least one edge case. See `test/code_lens_provider.test.ts` for a unit-style example.

- Grammar changes: `bazel run //test:update_snapshot` refreshes `test/example.bazelrc.snap`.

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
