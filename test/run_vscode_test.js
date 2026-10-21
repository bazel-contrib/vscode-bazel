// Launcher for //test:integration.
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
//
// Usage: run_vscode_test.js <runtime dir> <buildifier> [vscode-test args]

const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

// VS Code needs a display. Without one, fall back to xvfb-run (headless CI
// and dev boxes); fail fast if neither is available.
const headless =
  process.platform === "linux" &&
  !process.env.DISPLAY &&
  !process.env.WAYLAND_DISPLAY;
const xvfbRun = headless ? findOnPath("xvfb-run") : undefined;
if (headless && !xvfbRun) {
  console.error(
    "//test:integration needs a display for VS Code: run it from a desktop " +
      "session (DISPLAY is passed through) or install xvfb so xvfb-run is " +
      "on PATH.",
  );
  process.exit(1);
}

// The extension under test runs `bazel` (from PATH) inside the fixture
// workspace. Prefer bazelisk, so the fixture's .bazelversion is honoured:
// the Bazel running this test was itself started by bazelisk, which puts
// the resolved Bazel binary (and BAZEL_REAL) on PATH, and that one is the
// wrong version.
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
    "//test:integration needs `bazel` on PATH for the extension under test.",
  );
  process.exit(1);
}

const [runtime, buildifier] = process.argv
  .slice(2, 4)
  .map((p) => fs.realpathSync(p));
const vscodeTestArgs = process.argv.slice(4);

const scratch = fs.mkdtempSync(
  path.join(fs.realpathSync(os.tmpdir()), "vscode-bazel-integration-"),
);
const workDir = path.join(scratch, "extension");
const fixture = path.join(workDir, "test", "bazel_workspace");
const binDir = path.join(scratch, "bin");
const bazelWrapper = path.join(binDir, "bazel");
let child;

process.on("SIGTERM", () => onSignal("SIGTERM"));
process.on("SIGINT", () => onSignal("SIGINT"));

main().then(
  (status) => {
    cleanUp();
    process.exit(status);
  },
  (error) => {
    cleanUp();
    throw error;
  },
);

async function main() {
  fs.cpSync(runtime, workDir, { recursive: true, dereference: true });
  makeWritable(workDir);
  // The test runs from the runfiles root, where rules_js linked node_modules.
  fs.symlinkSync(
    path.resolve("node_modules"),
    path.join(workDir, "node_modules"),
  );

  // Tools for the extension under test, first on PATH:
  //  - `bazel`: a wrapper giving the fixture its own output base. A
  //    ~/.bazelrc may pin --output_base (setup-bazel does so in CI), and
  //    sharing it with the Bazel running this test would make every
  //    extension command queue behind the outer server until mocha gives
  //    up. Command-line startup flags win over rc files.
  //  - `buildifier`: the one from buildifier_prebuilt, so the tests don't
  //    depend on whatever is installed on the machine.
  fs.mkdirSync(binDir);
  fs.writeFileSync(
    bazelWrapper,
    `#!/usr/bin/env bash\nexec "${realBazel}" --output_base="${path.join(scratch, "output_base")}" "$@"\n`,
    { mode: 0o755 },
  );
  // buildifier_prebuilt's wrapper finds the binary through RUNFILES_DIR;
  // pin it here rather than trust the variable to survive the trip through
  // VS Code to the extension host.
  const runfilesDir = process.env.RUNFILES_DIR ?? path.resolve("..");
  fs.writeFileSync(
    path.join(binDir, "buildifier"),
    `#!/usr/bin/env bash\nexport RUNFILES_DIR="${runfilesDir}"\nexec "${buildifier}" "$@"\n`,
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

  // Warm the fixture up, as a developer would have before `npm test`: the
  // first command in a fresh output base starts a server and fetches
  // dependencies, which takes far longer than the tests' mocha timeout.
  console.log(`Warming up ${fixture} with ${realBazel}`);
  if (
    (await run(bazelWrapper, ["build", "//..."], { cwd: fixture, env })) !== 0
  ) {
    console.error("Building the fixture workspace failed; see above.");
    return 1;
  }

  // @vscode/test-cli's "exports" hides its bin, so locate it via the main
  // entry point instead.
  const vscodeTestCli = path.join(
    path.dirname(require.resolve("@vscode/test-cli")),
    "bin.mjs",
  );
  const command = [process.execPath, vscodeTestCli, ...vscodeTestArgs];
  if (xvfbRun) {
    command.unshift(xvfbRun, "-a");
  }
  return run(command[0], command.slice(1), { cwd: workDir, env });
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    child = spawn(command, args, { ...options, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      child = undefined;
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

// Bazel sends SIGTERM when the test times out; take the children and the
// scratch directory down with us instead of leaving them behind.
function onSignal(signal) {
  child?.kill(signal);
  cleanUp();
  process.exit(1);
}

function cleanUp() {
  // Stop the fixture's Bazel server before deleting its output base, whose
  // directories Bazel leaves read-only.
  if (fs.existsSync(bazelWrapper)) {
    spawnSync(bazelWrapper, ["shutdown"], { cwd: fixture, stdio: "ignore" });
  }
  makeWritable(scratch);
  fs.rmSync(scratch, { recursive: true, force: true });
}

// Bazel's output trees are read-only; copies of them, and the output base,
// need user write permission on every directory to be modified or deleted.
function makeWritable(dir) {
  let stat;
  try {
    stat = fs.lstatSync(dir);
  } catch {
    return;
  }
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
