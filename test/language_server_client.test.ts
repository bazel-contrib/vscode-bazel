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

import * as path from "path";
import * as assert from "assert";
import * as sinon from "sinon";
import * as vscode from "vscode";
import * as configuration from "../src/extension/configuration";
import { LocatedTool } from "../src/external-tools/tool_locator";
import {
  getEffectiveLspWorkspacePath,
  getLanguageServerCommand,
} from "../src/language_support/language-server-client";

describe("getEffectiveLspWorkspacePath", () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("returns undefined when bazel.workspace.path is not configured", () => {
    sandbox.stub(configuration, "getWorkspacePath").returns("");

    const result = getEffectiveLspWorkspacePath();

    assert.strictEqual(result, undefined);
  });

  it("returns the path as-is when it is absolute", () => {
    sandbox.stub(configuration, "getWorkspacePath").returns("/abs/path/to/ws");

    const result = getEffectiveLspWorkspacePath();

    assert.strictEqual(result, "/abs/path/to/ws");
  });

  it("resolves a relative path against the first workspace folder", () => {
    sandbox
      .stub(configuration, "getWorkspacePath")
      .returns("some/subdirectory");
    sandbox.stub(vscode.workspace, "workspaceFolders").get(() => [
      {
        uri: vscode.Uri.file("/repo/root"),
        name: "root",
        index: 0,
      } as vscode.WorkspaceFolder,
    ]);

    const result = getEffectiveLspWorkspacePath();

    assert.strictEqual(result, path.join("/repo/root", "some/subdirectory"));
  });

  it("returns undefined for a relative path with no workspace folders", () => {
    sandbox
      .stub(configuration, "getWorkspacePath")
      .returns("some/subdirectory");
    sandbox.stub(vscode.workspace, "workspaceFolders").get(() => undefined);

    const result = getEffectiveLspWorkspacePath();

    assert.strictEqual(result, undefined);
  });
});

describe("getLanguageServerCommand", () => {
  const starpls: LocatedTool = {
    command: "/storage/starpls",
    location: "/storage/starpls",
    source: "managed",
    version: "v0.1.22",
  };
  const managedBazel: LocatedTool = {
    command: "/storage/bazelisk",
    location: "/storage/bazelisk",
    source: "managed",
    version: "v1.28.1",
  };
  let sandbox: sinon.SinonSandbox;
  let lspArgs: string[];

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    lspArgs = [];
    sandbox.stub(configuration, "getLspServerArgs").callsFake(() => lspArgs);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("passes a downloaded Bazel to starpls", () => {
    lspArgs = ["--experimental_infer_ctx_attributes"];

    const server = getLanguageServerCommand(starpls, managedBazel);

    assert.deepStrictEqual(server.args, [
      "server",
      "--bazel_path=/storage/bazelisk",
      "--experimental_infer_ctx_attributes",
    ]);
  });

  it("leaves starpls to find Bazel on the PATH", () => {
    const server = getLanguageServerCommand(starpls, {
      command: "bazel",
      location: "/usr/bin/bazel",
      source: "path",
    });

    assert.deepStrictEqual(server.args, ["server"]);
  });

  it("keeps a Bazel path given in bazel.lsp.args", () => {
    lspArgs = ["server", "--bazel_path=/opt/bazel"];

    const server = getLanguageServerCommand(starpls, managedBazel);

    assert.deepStrictEqual(server.args, ["server", "--bazel_path=/opt/bazel"]);
  });

  it("starts a configured language server with bazel.lsp.args only", () => {
    lspArgs = ["--stdio"];

    const server = getLanguageServerCommand(
      { command: "my-lsp", location: "/usr/bin/my-lsp", source: "setting" },
      managedBazel,
    );

    assert.deepStrictEqual(server, { command: "my-lsp", args: ["--stdio"] });
  });
});
