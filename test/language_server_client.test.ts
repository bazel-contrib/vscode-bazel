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
import { getEffectiveLspWorkspacePath } from "../src/language_support/language-server-client";

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
