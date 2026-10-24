// `bazel run //:build`: materializes the build in the checkout, for the
// editor workflows that expect it there:
//
//  - dist/ with the bundles, the compiled sources and the compiled tests.
//    The F5 launch configurations, the Extension Test Runner and
//    `vscode-test` all read these.
//  - node_modules -> bazel-bin/node_modules, so editors and test tooling
//    resolve packages (TypeScript types, @vscode/test-cli, sinon, ...).
//  - syntaxes/bazelrc.tmLanguage.json, the generated grammar package.json
//    contributes, which a debug session loads from the checkout.
//
// Usage: export_dev_tree.js <dist tree> <bazelrc grammar json>

const fs = require("fs");
const path = require("path");

const workspace = process.env.BUILD_WORKSPACE_DIRECTORY;
if (!workspace) {
  console.error("Run this with `bazel run //:build`.");
  process.exit(1);
}
const [distTree, bazelrcGrammar] = process.argv
  .slice(2)
  .map((p) => fs.realpathSync(p));

const dist = path.join(workspace, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(distTree, dist, { recursive: true, dereference: true });
makeWritable(dist);

const nodeModules = path.join(workspace, "node_modules");
let existing;
try {
  existing = fs.lstatSync(nodeModules);
} catch {
  existing = undefined;
}
if (existing?.isSymbolicLink()) {
  fs.unlinkSync(nodeModules);
  existing = undefined;
}
if (existing) {
  console.log(`Leaving the existing ${nodeModules} directory alone.`);
} else {
  fs.symlinkSync(path.join("bazel-bin", "node_modules"), nodeModules);
}
const grammar = path.join(workspace, "syntaxes", "bazelrc.tmLanguage.json");
fs.copyFileSync(bazelrcGrammar, grammar);
fs.chmodSync(grammar, 0o644);

console.log(`Wrote ${dist} and ${grammar}, and linked ${nodeModules}.`);

// Bazel's outputs are read-only; give the copies ordinary permissions.
function makeWritable(dir) {
  const stat = fs.lstatSync(dir);
  if (!stat.isDirectory()) {
    return;
  }
  fs.chmodSync(dir, stat.mode | 0o200);
  for (const name of fs.readdirSync(dir)) {
    const child = path.join(dir, name);
    makeWritable(child);
    if (!fs.lstatSync(child).isDirectory()) {
      fs.chmodSync(child, fs.lstatSync(child).mode | 0o200);
    }
  }
}
