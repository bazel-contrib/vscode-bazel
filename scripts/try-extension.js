#!/usr/bin/env node

// Copyright 2026 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// This script packages the extension, downloads a local VS Code instance (or
// reuses a cached one), installs the packaged .vsix, and opens the test
// workspace so you can experiment interactively.
//
// Usage:
//   npm run try
//
// The VS Code instance uses isolated user-data and extensions directories
// under .vscode-test/ so it won't affect your normal VS Code installation.

const {
  downloadAndUnzipVSCode,
  resolveCliPathFromVSCodeExecutablePath,
} = require("@vscode/test-electron");
const { execSync, execFileSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/**
1 * Recursively copy a directory, skipping symlinks. The Bazel convenience
 * symlinks (bazel-bin, bazel-out, bazel-testlogs, etc.) are all symlinks,
 * so this single check keeps them out of the copy without needing an
 * explicit name list.
 */
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isSymbolicLink()) {
      continue;
    } else if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function main() {
  const projectRoot = path.resolve(__dirname, "..");

  // Step 1: Package the extension (this also compiles via vscode:prepublish)
  console.log("Packaging extension...");
  execSync("npm run package", { cwd: projectRoot, stdio: "inherit" });

  // Find the most recently created .vsix file
  const vsixFile = fs
    .readdirSync(projectRoot)
    .filter((f) => f.endsWith(".vsix"))
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(projectRoot, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)[0]?.name;

  if (!vsixFile) {
    console.error("Error: No .vsix file found after packaging.");
    process.exit(1);
  }

  console.log(`Found package: ${vsixFile}`);

  // Step 2: Download VS Code (or reuse cached version from .vscode-test/)
  console.log("Resolving VS Code installation...");
  const vscodeExecutablePath = await downloadAndUnzipVSCode();
  const cliPath = resolveCliPathFromVSCodeExecutablePath(vscodeExecutablePath);

  // Use isolated directories so we don't pollute the user's VS Code
  const userDataDir = path.join(projectRoot, ".vscode-test", "try-user-data");
  const extensionsDir = path.join(
    projectRoot,
    ".vscode-test",
    "try-extensions",
  );

  // Step 3: Install the packaged extension into the isolated instance
  console.log("Installing extension...");
  execFileSync(
    cliPath,
    [
      "--install-extension",
      path.join(projectRoot, vsixFile),
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir,
      "--force",
    ],
    { stdio: "inherit" },
  );

  // Step 4: Copy the test workspace to a disposable location so edits
  // made during experimentation don't touch the source-controlled original.
  const srcWorkspace = path.join(projectRoot, "test", "bazel_workspace");
  const workspaceCopy = path.join(projectRoot, ".vscode-test", "try-workspace");

  // Always start from a fresh copy
  if (fs.existsSync(workspaceCopy)) {
    fs.rmSync(workspaceCopy, { recursive: true, force: true });
  }

  console.log(`Copying test workspace to ${workspaceCopy} ...`);
  copyDirSync(srcWorkspace, workspaceCopy);

  // Step 5: Launch VS Code with the disposable workspace copy
  console.log(`Launching VS Code with workspace: ${workspaceCopy}`);

  const child = spawn(
    cliPath,
    [
      "--user-data-dir",
      userDataDir,
      "--extensions-dir",
      extensionsDir,
      workspaceCopy,
    ],
    {
      detached: true,
      stdio: "ignore",
    },
  );

  child.unref();
  console.log(
    "VS Code launched. You can close this terminal.\n" +
      "Any edits you make in the workspace are in the disposable copy at:\n" +
      `  ${workspaceCopy}`,
  );
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
