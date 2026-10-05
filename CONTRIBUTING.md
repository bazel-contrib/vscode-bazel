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
- Implement `enable(context)` to check preconditions (e.g. `checkBazelIsAvailable()`) and return `false` if they aren't met, then create providers/commands/watchers and register them in `this.disposables`.
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

### Workspace model

Every feature must agree on which Bazel workspace a file belongs to
(see [#684](https://github.com/bazel-contrib/vscode-bazel/issues/684) and
[#416](https://github.com/bazel-contrib/vscode-bazel/issues/416)):

- There is exactly one active Bazel root per VS Code workspace folder. Users
  with several independent roots open them as folders of a multi-root
  workspace.
- The root is `bazel.workspace.path` if set, for the whole folder. Otherwise
  it is the nearest `MODULE.bazel`/`REPO.bazel`/`WORKSPACE.bazel`/`WORKSPACE`
  at or above the folder root. Never search upwards from an individual file;
  use `resolveActiveBazelRoot(folder)` for a folder and
  `getBazelWorkspaceFolder(file)` for a file (in
  [`src/bazel/bazel_utils.ts`](src/bazel/bazel_utils.ts)), and subscribe to
  `onDidChangeActiveBazelRoot` if your feature caches anything per root.
- Files inside the root get `//pkg` labels, even below a nested marker file
  (Bazel does not treat those as repository boundaries). Files inside a local
  override of the root's `MODULE.bazel` (e.g. `local_path_override`) will get
  `@repo//pkg` labels, wherever the override lives (work in progress, #416).
- Every other file (e.g. one in Bazel's repository cache reached via Go to
  Definition) is unsupported: never spawn Bazel for it and never compute a
  label for it. `locateFile(file)` tells which case applies: another Bazel
  workspace, no Bazel workspace, or ignored by `bazel.workspace.pathsToIgnore`.
  Passive features (CodeLens, symbols, definitions, completion, the target
  quick pick's prefill) stay silent; explicit commands (e.g. Copy Label) tell
  the user why they did nothing (`notifyIfUnsupported`).
- Once the external-module mapping for #416 exists, don't call a file
  unsupported while it is still resolving.
- Never write to the user's settings to "fix" their workspace setup; point
  them to `bazel.workspace.path` or multi-root workspaces instead.

## Testing

We expect contributions to include tests that demonstrate and validate the intended behavior.

- Running tests: Use `npm run test` to run the tests. These tests will download a local version of vscode into the `.vscode-test` directory and will run integration tests against the extension in that workspace.

- New features: add a set of VS Code integration tests that demo the intended behaviour by making use of the mock workspace under `test/bazel_workspace` (vscode-tests will be executed within this workspace). Integration tests should exercise the extension as a user would (for example: open editors, execute commands with `vscode.commands.executeCommand`, and assert on the editor state or extension outputs). See `test/go_to_label.test.ts` for a minimal integration-style example.

- Utilities and bug fixes: extend the existing unit tests. If you add a new util or fix an existing one, include unit tests that cover the happy path and at least one edge case. See `test/code_lens_provider.test.ts` for a unit-style example.

- New features: alongside the `<Name>Feature` class itself, add a `test/<name>_feature.test.ts` unit test covering at least the "preconditions not met" and "preconditions met" branches of `enable()`. See `test/code_lens_feature.test.ts` or `test/test_explorer_feature.test.ts` for examples.

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
