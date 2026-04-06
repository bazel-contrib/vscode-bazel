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

import { logDebug } from "../extension/logger";
import { Platform } from "./types";

/**
 * Detects the current platform and architecture.
 * @returns The detected platform enum value.
 * @throws Error if the platform is not supported.
 */
export function detectPlatform(): Platform {
  const platform = process.platform;
  const arch = process.arch;

  logDebug(`Detecting platform: ${platform}-${arch}`);

  let detectedPlatform: Platform;
  switch (platform) {
    case "win32":
      detectedPlatform =
        arch === "arm64" ? Platform.WINDOWS_ARM64 : Platform.WINDOWS_X64;
      break;
    case "linux":
      detectedPlatform =
        arch === "arm64" ? Platform.LINUX_ARM64 : Platform.LINUX_X64;
      break;
    case "darwin":
      detectedPlatform =
        arch === "arm64" ? Platform.DARWIN_ARM64 : Platform.DARWIN_X64;
      break;
    default:
      const errorMsg = `Unsupported platform: ${platform}-${arch}`;
      logDebug(errorMsg);
      throw new Error(errorMsg);
  }

  logDebug(`Detected platform: ${detectedPlatform}`);
  return detectedPlatform;
}
