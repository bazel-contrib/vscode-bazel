/**
 * Tool Checksum Validator
 *
 * Downloads every tool binary from its GitHub release and verifies it against
 * the pinned SHA256 checksum, which detects outdated or wrong checksums.
 */

import * as assert from "assert";
import * as path from "path";
import * as os from "os";
import {
  downloadAndVerify,
  getToolDownloadUrl,
} from "../src/external-tools/tool_downloader";
import {
  loadToolsConfig,
  ToolConfig,
  Platform,
} from "../src/external-tools/tool_config";
import { ILogger } from "../src/extension/logger_interface";

// Runs under plain mocha (//test:tool_checksums), outside VS Code, so log to
// the console.
/* eslint-disable no-console */
const consoleLogger: ILogger = {
  logDebug: (message: string, _showMessage?: boolean, ...args: unknown[]) => {
    console.debug(message, ...args);
  },
  logInfo: (message: string, _showMessage?: boolean, ...args: unknown[]) => {
    console.info(message, ...args);
  },
  logWarn: (message: string, _showMessage?: boolean, ...args: unknown[]) => {
    console.warn(message, ...args);
  },
  logError: (message: string, _showMessage?: boolean, ...args: unknown[]) => {
    console.error(message, ...args);
  },
};
/* eslint-enable no-console */

const actualConfig = loadToolsConfig();

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
              // Same URL the extension downloads from at runtime.
              const url = getToolDownloadUrl(
                typedToolConfig,
                platform as Platform,
              );
              assert.ok(url, `No download URL for ${toolKey} ${platform}`);
              const tempFile = path.join(os.tmpdir(), `${toolKey}-${platform}`);
              await downloadAndVerify(
                url,
                typedToolConfig.checksums[platform as Platform],
                tempFile,
                consoleLogger,
              );
            });
          },
        );
      });
    });
  });
});
