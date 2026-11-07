import * as assert from "assert";
import * as crypto from "crypto";
import * as fs from "fs/promises";
import * as http from "http";
import { AddressInfo } from "net";
import * as os from "os";
import * as path from "path";

import { ILogger } from "../src/extension/logger_interface";
import {
  downloadAndVerify,
  findOutdatedManagedTool,
  getManagedToolPath,
  getToolDownloadUrl,
} from "../src/external-tools/tool_downloader";
import { ToolConfig } from "../src/external-tools/tool_config";

const silentLogger: ILogger = {
  logDebug: () => undefined,
  logInfo: () => undefined,
  logWarn: () => undefined,
  logError: () => undefined,
};

const toolConfig: ToolConfig = {
  repository: "owner/tool",
  version: "v2.0.0",
  configKey: "tool.executable",
  assets: {
    "linux-amd64": "tool-linux-amd64",
    "win32-amd64": "tool-windows-amd64.exe",
  },
  executableName: "tool",
  checksums: {},
};

describe("tool_downloader", () => {
  const content = Buffer.from("#!/bin/sh\necho tool\n");
  const checksum = crypto.createHash("sha256").update(content).digest("hex");
  let server: http.Server;
  let url: string;
  let toolsDir: string;

  before(async () => {
    server = http.createServer((_request, response) => {
      response.end(content);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/tool`;
  });

  after(() => {
    server.close();
  });

  beforeEach(async () => {
    toolsDir = await fs.mkdtemp(path.join(os.tmpdir(), "vscode-bazel-dl-"));
  });

  afterEach(async () => {
    await fs.rm(toolsDir, { recursive: true, force: true });
  });

  it("builds the release download URL", () => {
    assert.strictEqual(
      getToolDownloadUrl(toolConfig, "linux-amd64"),
      "https://github.com/owner/tool/releases/download/v2.0.0/tool-linux-amd64",
    );
    assert.strictEqual(
      getToolDownloadUrl(toolConfig, "darwin-arm64"),
      undefined,
    );
  });

  it("keeps each version and the asset name in the managed path", () => {
    assert.strictEqual(
      getManagedToolPath(toolsDir, "Tool", toolConfig, "win32-amd64"),
      path.join(toolsDir, "Tool", "v2.0.0", "tool-windows-amd64.exe"),
    );
  });

  it("downloads and verifies a binary", async () => {
    const destination = path.join(toolsDir, "Tool", "v2.0.0", "tool");

    await downloadAndVerify(url, checksum, destination, silentLogger);

    assert.deepStrictEqual(await fs.readFile(destination), content);
    if (process.platform !== "win32") {
      // eslint-disable-next-line no-bitwise
      assert.ok((await fs.stat(destination)).mode & 0o100);
    }
  });

  it("rejects a checksum mismatch and leaves nothing behind", async () => {
    const destination = path.join(toolsDir, "Tool", "v2.0.0", "tool");

    await assert.rejects(
      downloadAndVerify(url, "0".repeat(64), destination, silentLogger),
      /failed checksum verification/,
    );

    assert.deepStrictEqual(await fs.readdir(path.dirname(destination)), []);
  });

  it("finds the newest outdated managed copy", async () => {
    for (const version of ["v1.9.0", "v1.10.0", "v2.0.0"]) {
      const dir = path.join(toolsDir, "Tool", version);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, "tool-linux-amd64"), "");
    }

    const outdated = await findOutdatedManagedTool(
      toolsDir,
      "Tool",
      toolConfig,
    );

    assert.deepStrictEqual(outdated, {
      path: path.join(toolsDir, "Tool", "v1.10.0", "tool-linux-amd64"),
      version: "v1.10.0",
    });
  });
});
