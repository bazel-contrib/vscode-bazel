// Copyright 2025 The Bazel Authors. All rights reserved.
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

import * as fs from "fs";
import * as os from "os";
import { pipeline } from "stream/promises";
import * as vscode from "vscode";
import { extensionContext } from "../extension/extension";

/**
 * Returns the expected name of the buildifier executable for the current
 * platform.
 * @returns The name of the buildifier executable.
 */
function getBuildifierExecutableName(): string {
  const platform = os.platform();
  const arch = os.arch();

  let name: string;
  switch (platform) {
    case "darwin":
      name =
        arch === "arm64"
          ? "buildifier-darwin-arm64"
          : "buildifier-darwin-amd64";
      break;
    case "linux":
      name =
        arch === "arm64" ? "buildifier-linux-arm64" : "buildifier-linux-amd64";
      break;
    case "win32":
      name = "buildifier-windows-amd64.exe";
      break;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
  return name;
}

function getBuildifierExecutableDir(version: string): vscode.Uri {
  return vscode.Uri.joinPath(
    extensionContext.globalStorageUri,
    "buildifier",
    version,
  );
}

export function getBuildifierExecutablePath(version: string): vscode.Uri {
  return vscode.Uri.joinPath(
    getBuildifierExecutableDir(version),
    getBuildifierExecutableName(),
  );
}

/**
 * Downloads the buildifier executable for the current platform and the given
 * version.
 * @param version The version of buildifier to download.
 * @returns The path to the downloaded executable.
 */
export async function downloadBuildifier(version: string): Promise<vscode.Uri> {
  const exe = getBuildifierExecutableName();
  const url = `https://github.com/bazelbuild/buildtools/releases/download/${version}/${exe}`;
  const dir = getBuildifierExecutableDir(version);
  // example: '/Users/laurenz/Library/Application Support/Code/User/globalStorage/bazelbuild.vscode-bazel/buildifier/v8.2.1/buildifier-darwin-arm64'
  const dst = getBuildifierExecutablePath(version);

  if (!fs.existsSync(dir.fsPath)) {
    fs.mkdirSync(dir.fsPath, { recursive: true });
  }

  // Show progress notification while downloading the buildifier executable
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Downloading buildifier ${version}...`,
      cancellable: false,
    },
    async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(
          `Failed to download buildifier from ${url}: ${response.statusText}`,
        );
      }
      if (!response.body) {
        throw new Error(`Response body of ${url} is empty.`);
      }

      const fileStream = fs.createWriteStream(dst.fsPath);
      await pipeline(response.body as any, fileStream);

      makeExecutable(dst);
    },
  );

  return dst;
}

/**
 * Makes the given file executable.
 * @param uri The URI of the file to make executable.
 */
function makeExecutable(uri: vscode.Uri) {
  if (os.platform() !== "win32") {
    fs.chmodSync(uri.fsPath, 0o755);
  }
}
