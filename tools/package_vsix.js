// Packages a staged extension directory into a .vsix with vsce.
//
// Usage: package_vsix.js <staging dir> <output .vsix>
//
// Bazel leaves its outputs read-only and executable (mode 0555), and vsce
// copies each file's mode into the archive. Package from a scratch copy with
// ordinary modes instead, so the .vsix matches what `npm run package`
// produces from a source checkout.

const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const [stagingDir, outFile] = process.argv.slice(2).map((p) => path.resolve(p));

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "vsix-"));
const extensionDir = path.join(scratch, "extension");
fs.cpSync(stagingDir, extensionDir, { recursive: true, dereference: true });
normalizeModes(extensionDir);

const result = spawnSync(
  process.execPath,
  [
    require.resolve("@vscode/vsce/vsce"),
    "package",
    "--no-dependencies",
    "--out",
    outFile,
  ],
  { cwd: extensionDir, stdio: "inherit" },
);
fs.rmSync(scratch, { recursive: true, force: true });
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 1);

function normalizeModes(dir) {
  fs.chmodSync(dir, 0o755);
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      normalizeModes(entryPath);
    } else {
      fs.chmodSync(entryPath, 0o644);
    }
  }
}
