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
code; the default build task (`Ctrl+Shift+B`) does the same. The familiar
npm scripts (`npm run build`, `npm test`, `npm run package`, ...) still exist,
but only forward to Bazel.

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

## Code structure

Keep each discrete piece of functionality in its own directory under `src/`
(for example `src/codelens/`, `src/buildifier/`, `src/test-explorer/`) instead
of growing unrelated logic inside shared files like `src/extension/extension.ts`.
This keeps features easy to find, test, and reason about in isolation.

### Implement functionality as a "feature"

Any functionality that a user could reasonably want to turn off (because they
don't use it, or because it has a performance cost, e.g. background queries)
must be implemented behind the `BaseExtensionFeature` pattern defined in
[`src/extension/extension_feature.ts`](src/extension/extension_feature.ts),
rather than being wired up directly in `activate()`. This is the established
pattern already used by CodeLens, WorkspaceTree, Buildifier, LanguageSupport,
and TestExplorer, and it's what allows us to close out
[#490](https://github.com/bazel-contrib/vscode-bazel/issues/490) feature by
feature instead of all at once.

To comply with the pattern, a feature must:

- Live in its own directory, exposing a single `<Name>Feature extends BaseExtensionFeature` class, conventionally named `<name>_feature.ts` (e.g. `src/codelens/code_lens_feature.ts`).
- Pass a unique `featureName` to `super()`. The base class derives from it both the `bazel.<featureName>.enable` setting and the `bazel.feature.<featureName>.enabled` context key (useful for `when` clauses in `package.json`) - add the setting to `package.json`, but don't manage either yourself. Any other settings the feature needs belong in the same `bazel.<featureName>.*` section (e.g. `bazel.buildifier.executable` alongside `bazel.buildifier.enable`) rather than as flat top-level `bazel.*` keys - see "Settings" below.
- List the external tools it can't work without (Bazel, Buildifier, the language server) in `requiredTools()`, and those it only uses if available in `optionalTools()`. Don't look for the tools yourself: the base class resolves them through the tool registry (`src/external-tools/tool_registry.ts`), which also offers missing ones for download. While a required tool is missing, the feature waits instead of failing (context key `bazel.feature.<featureName>.waiting`), and it is enabled, or restarted, when a tool it lists changes.
- Implement `enable(context)` to check any remaining preconditions and return `false` if they aren't met, then create providers/commands/watchers and register them in `this.disposables`. Read a required tool's command through `src/extension/configuration.ts` (e.g. `getBazelExecutablePath()`), which returns the resolved tool.
- Rely on the default `disable()`, which disposes everything in `this.disposables`, unless the feature holds extra state that needs resetting (see `LanguageSupportFeature.disable()` for an example that does).
- Be instantiated in `activate()` via `await <Name>Feature.create(context)` and pushed onto `context.subscriptions` - don't call `enable()`/`disable()` directly.

See `src/test-explorer/test_explorer_feature.ts` for a minimal example, or
`src/language_support/language_support_feature.ts` for one that switches
between two internal implementations depending on configuration. Do not
register new commands, providers, or watchers directly in
`src/extension/extension.ts`; wrap them in a feature instead so users can
selectively disable them.

### Settings

Cluster every setting under the section of the feature it configures -
`bazel.<featureName>.*` - rather than adding another flat `bazel.*` key.
Settings that apply across features (how bazel itself is invoked, regardless
of which feature triggered it) belong under the shared `bazel.commandLine.*`
section instead (e.g. `bazel.commandLine.commandArgs`). Only settings with no
sensible feature or cross-cutting home, like `bazel.executable` itself, stay
directly under `bazel.*`.

Renaming or moving an existing setting is a breaking change for anyone who
has it set: add the rename to `RENAMED_SETTINGS` in
[`src/extension/settings_migration.ts`](src/extension/settings_migration.ts)
so the old key keeps being honored as a read-only alias (read the setting via
`getRenamedSetting()` and listen for changes via `affectsRenamedSetting()`),
and mention the rename in your PR description/commit message. The extension
never rewrites a user's settings files, since `.vscode/settings.json` is often
checked in and shared across extension versions.

Also keep the old key registered in `package.json`, with a
`markdownDeprecationMessage`/`deprecationMessage` pointing at its
replacement (see the deprecated block at the end of `contributes.configuration.properties`)
instead of deleting it outright, so VS Code does not flag it as an unknown
setting. Once a rename has had a release or two to reach users, its
deprecated entry and matching `RENAMED_SETTINGS` entry can be deleted
together.

## Testing

We expect contributions to include tests that demonstrate and validate the intended behavior.

- Running tests: `bazel test //...` (or `npm test`) typechecks, lints and format-checks the sources, checks the grammar snapshot and runs the VS Code integration tests (`//test:integration`). The integration tests download a VS Code build into `~/.cache/vscode-bazel/vscode-test`, need network access for that, run against the extension in the `test/bazel_workspace` fixture, and need a display (use `xvfb-run -a bazel test //...` on a headless Linux machine) plus `bazel`, `c++filt` and `rustfilt` on `PATH`. The Extension Test Runner in VS Code and the "Launch Extension Tests" configuration run the same tests from `dist/` after `bazel run //:build`.

- Grammar changes: `bazel run //test:update_snapshot` refreshes `test/example.bazelrc.snap`.

- New features: add a set of VS Code integration tests that demo the intended behaviour by making use of the mock workspace under `test/bazel_workspace` (vscode-tests will be executed within this workspace). Integration tests should exercise the extension as a user would (for example: open editors, execute commands with `vscode.commands.executeCommand`, and assert on the editor state or extension outputs). See `test/go_to_label.test.ts` for a minimal integration-style example.

- Utilities and bug fixes: extend the existing unit tests. If you add a new util or fix an existing one, include unit tests that cover the happy path and at least one edge case. See `test/code_lens_provider.test.ts` for a unit-style example.

- New features: alongside the `<Name>Feature` class itself, add a `test/<name>_feature.test.ts` unit test covering at least the "preconditions not met" and "preconditions met" branches, e.g. which tools `requiredTools()` lists (see `test/code_lens_feature.test.ts`) and how the feature reacts to a tool becoming available (fake the registry with `setToolRegistry`, see `test/language_support_feature.test.ts`). See `test/code_lens_feature.test.ts` or `test/test_explorer_feature.test.ts` for examples.

- Note: If you are getting test failures from files that no longer exist, try running `npm run clean` to clean the workspace and then `bazel run //:build && bazel test //...` again.

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
