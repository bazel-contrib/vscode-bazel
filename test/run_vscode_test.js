// Launcher for //test:unit.
//
// Bazel's output tree is read-only, but VS Code, mocha and the extension's
// own `bazel` invocations inside the fixture workspace all expect to run in
// a writable extension directory, as they do in a source checkout. So copy
// the assembled runtime tree into a scratch directory, make it writable,
// point it at the linked node_modules, and run vscode-test from there.
//
// The scratch directory lives under the system temp dir rather than
// TEST_TMPDIR on purpose: TEST_TMPDIR sits inside Bazel's execroot, whose
// root carries BUILD.bazel/MODULE.bazel symlinks, and tests that expect a
// file to be "outside any Bazel workspace" would find those when walking up.

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const runtime = fs.realpathSync(process.argv[2]);
const scratch = fs.mkdtempSync(
  path.join(fs.realpathSync(os.tmpdir()), "vscode-bazel-unit-"),
);
const workDir = path.join(scratch, "extension");
const fixture = path.join(workDir, "test", "bazel_workspace");

fs.cpSync(runtime, workDir, { recursive: true, dereference: true });
makeWritable(workDir);
// The test runs from the runfiles root, where rules_js linked node_modules.
fs.symlinkSync(
  path.resolve("node_modules"),
  path.join(workDir, "node_modules"),
);

// The extension under test runs `bazel` (from PATH) inside the fixture
// workspace. Give that Bazel its own output base: a ~/.bazelrc may pin
// --output_base (setup-bazel does so in CI), and sharing it with the Bazel
// that is running this very test would make every extension command queue
// behind the outer server until mocha gives up. A wrapper script first on
// PATH adds the startup flag; command-line startup flags win over rc files.
//
// Prefer bazelisk, so the fixture's .bazelversion is honoured. The Bazel
// running this test was itself started by bazelisk, which puts the resolved
// Bazel binary (and BAZEL_REAL) on PATH; that one is the wrong version.
const realBazel =
  findOnPath("bazelisk") ??
  findOnPath(
    "bazel",
    (candidate) =>
      candidate !== process.env.BAZEL_REAL &&
      !candidate.includes(path.join("bazelisk", "downloads")),
  );
if (!realBazel) {
  console.error(
    "//test:unit needs `bazel` on PATH for the extension under test.",
  );
  process.exit(1);
}
const binDir = path.join(scratch, "bin");
fs.mkdirSync(binDir);
const bazelWrapper = path.join(binDir, "bazel");
fs.writeFileSync(
  bazelWrapper,
  `#!/usr/bin/env bash\nexec "${realBazel}" --output_base="${path.join(scratch, "output_base")}" "$@"\n`,
  { mode: 0o755 },
);

const env = {
  ...process.env,
  PATH: binDir + path.delimiter + process.env.PATH,
  // Where vscode-test keeps the downloaded VS Code. Shared across runs so
  // the ~170MB download happens once per machine.
  VSCODE_TEST_CACHE_PATH:
    process.env.VSCODE_TEST_CACHE_PATH ??
    path.join(os.homedir(), ".cache", "vscode-bazel", "vscode-test"),
};
fs.mkdirSync(env.VSCODE_TEST_CACHE_PATH, { recursive: true });

// Warm the fixture up, as `npm test` expects a developer to have done: the
// first command in a fresh output base starts a server and fetches
// dependencies, which takes far longer than the tests' mocha timeout.
console.log(`Warming up ${fixture} with ${realBazel}`);
const warmup = spawnSync(bazelWrapper, ["build", "//..."], {
  cwd: fixture,
  env,
  stdio: "inherit",
});
if (warmup.status !== 0) {
  console.error("Building the fixture workspace failed; see above.");
  cleanUp();
  process.exit(1);
}

// @vscode/test-cli's "exports" hides its bin, so locate it via the main
// entry point instead.
const vscodeTestCli = path.join(
  path.dirname(require.resolve("@vscode/test-cli")),
  "bin.mjs",
);

const result = spawnSync(
  process.execPath,
  [vscodeTestCli, ...process.argv.slice(3)],
  { cwd: workDir, stdio: "inherit", env },
);
cleanUp();
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);

function cleanUp() {
  // Stop the fixture's Bazel server before deleting its output base, whose
  // directories Bazel leaves read-only.
  spawnSync(bazelWrapper, ["shutdown"], { cwd: fixture, env, stdio: "ignore" });
  makeWritable(scratch);
  fs.rmSync(scratch, { recursive: true, force: true });
}

// Bazel's output trees are read-only; copies of them, and the output base,
// need user write permission on every directory to be modified or deleted.
function makeWritable(dir) {
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) {
    return; // files need no change; symlinks are not followed
  }
  fs.chmodSync(dir, stat.mode | 0o200);
  for (const name of fs.readdirSync(dir)) {
    makeWritable(path.join(dir, name));
  }
}

function findOnPath(name, accept = () => true) {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    const candidate = path.join(dir, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
    } catch {
      continue;
    }
    if (accept(candidate)) {
      return candidate;
    }
  }
  return undefined;
}
