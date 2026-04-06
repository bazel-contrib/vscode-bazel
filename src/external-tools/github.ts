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

import { logDebug, logError } from "../extension/logger";
import { GitHubAsset, GitHubRelease } from "./types";

/**
 * Fetches release information from GitHub's REST API with support for
 * authenticated requests to overcome rate limiting in CI.
 *
 * @param repository GitHub repository in "owner/repo" format
 * @param version Release tag (e.g., "v8.5.1")
 * @param token Optional GitHub personal access token
 * @returns Promise resolving to release metadata
 * @throws Error with repository, version, and API context
 */
export async function getGitHubRelease(
  repository: string,
  version: string,
  token?: string,
): Promise<GitHubRelease> {
  // Use the direct release-by-tag endpoint
  const apiUrl = `https://api.github.com/repos/${repository}/releases/tags/${version}`;

  logDebug(`Fetching GitHub release info for ${repository}@${version} from ${apiUrl}`);

  try {
    const headers: Record<string, string> = {
      "User-Agent": "vscode-bazel-checksum-validator/1.0.0",
      Accept: "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2026-03-10",
    };

    // Add Authorization header if token is provided
    if (token) {
      headers.Authorization = `token ${token}`;
      logDebug(`Using authenticated request for ${repository}@${version}`);
    } else {
      logDebug(`Using unauthenticated request for ${repository}@${version}`);
    }

    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${apiUrl}`);
    }

    const release = (await response.json()) as GitHubRelease;
    logDebug(`Successfully fetched release info for ${repository}@${version} with ${release.assets.length} assets`);
    return release;
  } catch (error) {
    const errorMsg = `Failed to fetch release info for ${repository}@${version}: ${error instanceof Error ? error.message : String(error)}`;
    logError(errorMsg, false, error);
    throw new Error(errorMsg);
  }
}

/**
 * Retrieve asset entry from list, based on filename.
 */
export function findMatchingGithubAsset(
  assets: GitHubAsset[],
  filename: string,
): GitHubAsset | null {
  return assets.find((asset) => asset.name === filename) || null;
}
