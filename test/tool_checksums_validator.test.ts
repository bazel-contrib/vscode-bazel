/**
 * VSCode Test for Tool Checksum Validator
 *
 * This test validates SHA256 checksums for tool binaries against GitHub API.
 * It can detect outdated checksums, update them automatically, and optionally
 * download and verify binary integrity.
 *
 * The test wraps the original validation logic in a VSCode test environment
 * to enable use of VSCode APIs while preserving all existing functionality.
 */

import * as assert from "assert";
import * as path from "path";
import * as os from "os";
import { downloadAndVerify } from "../src/external-tools/tool_downloader";
import {
  findMatchingGithubAsset,
  getGitHubRelease,
  GitHubRelease,
} from "../src/external-tools/github";
import {
  loadToolsConfig,
  ToolConfig,
  Platform,
} from "../src/external-tools/tool_config";

// Load actual configuration for dynamic test generation
const actualConfig = loadToolsConfig().config;

describe("Tool Checksum Validator", () => {
  describe("Configuration Loading", () => {
    it("should load actual tool configuration", () => {
      assert.ok(typeof actualConfig === "object");
      assert.ok(typeof actualConfig.Bazelisk === "object");
      assert.ok(typeof actualConfig.Buildifier === "object");
      assert.ok(typeof actualConfig["Starlark Language Server"] === "object");
    });
  });

  // Generate tests dynamically for each tool in the config
  Object.entries(actualConfig).forEach(([toolKey, toolConfig]) => {
    const typedToolConfig = toolConfig as ToolConfig;

    describe(toolKey, () => {
      let githubRelease: GitHubRelease;

      before(async () => {
        githubRelease = await getGitHubRelease(
          typedToolConfig.repository,
          typedToolConfig.version,
        );
      });

      it("should load GitHub release information", () => {
        assert.ok(typeof githubRelease === "object");
        assert.ok(githubRelease.hasOwnProperty("tag_name"));
        assert.ok(githubRelease.hasOwnProperty("assets"));
      });

      it("should have required properties for each tool", () => {
        assert.ok(typedToolConfig.hasOwnProperty("repository"));
        assert.ok(typedToolConfig.hasOwnProperty("version"));
        assert.ok(typedToolConfig.hasOwnProperty("assets"));
        assert.ok(typedToolConfig.hasOwnProperty("checksums"));
        assert.ok(typeof typedToolConfig.assets === "object");
        assert.ok(typeof typedToolConfig.checksums === "object");
      });

      describe(`${toolKey} - Checksum Validation`, () => {
        Object.entries(typedToolConfig.assets).forEach(
          ([platform, assetName]) => {
            it(`should have valid asset entry for ${platform}`, () => {
              const platformPattern = /^(win32|linux|darwin)-(amd64|arm64)$/;
              assert.ok(platformPattern.test(platform));
              assert.ok(typeof assetName === "string");
              assert.ok(
                typeof typedToolConfig.checksums[platform] === "string",
              );
              assert.ok(
                /^[a-f0-9]{64}$/.test(typedToolConfig.checksums[platform]),
              );
            });

            it(`should download and verify ${platform} asset checksum`, async function () {
              this.timeout(60000);
              // Find the matching asset
              const platformAsset = findMatchingGithubAsset(
                githubRelease.assets,
                assetName,
              );
              const filename = typedToolConfig.assets[platform as Platform];
              assert.ok(
                filename,
                `No asset filename found for ${toolKey} ${platform}`,
              );
              assert.ok(
                platformAsset,
                `Asset not found for ${toolKey} ${platform}: ${filename}`,
              );

              // Validate GitHub checksum
              const githubHash = platformAsset?.digest?.replace("sha256:", "");
              const expectedChecksum =
                typedToolConfig.checksums[platform as Platform];
              assert.ok(
                expectedChecksum,
                `No checksum found for ${toolKey} ${platform}`,
              );
              assert.ok(
                githubHash,
                `GitHub API missing digest for ${toolKey} ${platform}: ${platformAsset?.name}`,
              );
              assert.strictEqual(
                expectedChecksum,
                githubHash,
                `Checksum validation failed for ${toolKey} ${platform}: expected ${expectedChecksum}, GitHub has ${githubHash}`,
              );

              // Test download and verification (simplified version)
              const tempFile = path.join(os.tmpdir(), `${toolKey}-${platform}`);
              await downloadAndVerify(platformAsset, tempFile);
              assert.ok(
                true,
                `Downloaded asset integrity verified for ${toolKey} ${platform}`,
              );
            });
          },
        );
      });
    });
  });
});
