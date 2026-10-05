// Copyright 2024 The Bazel Authors. All rights reserved.
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

import * as vscode from "vscode";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as assert from "assert";
import * as sinon from "sinon";

async function openSourceFile(sourceFile: string) {
  const doc = await vscode.workspace.openTextDocument(
    vscode.Uri.file(sourceFile),
  );
  const editor = await vscode.window.showTextDocument(
    doc,
    vscode.ViewColumn.One,
    false,
  );
  return editor;
}
function setCursorInEditor(
  editor: vscode.TextEditor,
  anchor: vscode.Position,
  active: vscode.Position,
) {
  editor.selection = new vscode.Selection(anchor, active);
  editor.revealRange(new vscode.Range(anchor, active));
}

interface TestCase {
  name: string;
  cursorPos: vscode.Position;
  expectedLabel: string;
}

describe("Copy Label To Clipboard", () => {
  const workspacePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );

  const buildFilePath = path.join(workspacePath, "pkg1", "BUILD");
  const testCases: TestCase[] = [
    {
      name: "should copy package name label to clipboard",
      cursorPos: new vscode.Position(3, 14),
      expectedLabel: "//pkg1:pkg1",
    },
    {
      name: "should copy relative file label to clipboard",
      cursorPos: new vscode.Position(9, 14),
      expectedLabel: "//pkg1:main.py",
    },
    {
      name: "should copy target name label to clipboard",
      cursorPos: new vscode.Position(12, 13),
      expectedLabel: "//pkg1:main",
    },
    {
      name: "should copy relative target reference label to clipboard",
      cursorPos: new vscode.Position(13, 15),
      expectedLabel: "//pkg1:src_files",
    },
    {
      name: "should copy full label to clipboard",
      cursorPos: new vscode.Position(14, 20),
      expectedLabel: "//visibility:public",
    },
    {
      name: "should copy short package label in deps to clipboard",
      cursorPos: new vscode.Position(15, 15),
      expectedLabel: "//pkg1:pkg1",
    },
    {
      name: "should copy external label to clipboard",
      cursorPos: new vscode.Position(1, 15),
      expectedLabel: "@local_config_platform//:constraints.bzl",
    },
    {
      name: "should not misinterpret a rule name as a label",
      cursorPos: new vscode.Position(7, 5),
      expectedLabel: "",
    },
    {
      name: "should not misinterpret an empty line as a label",
      cursorPos: new vscode.Position(17, 0),
      expectedLabel: "",
    },
    {
      name: "should not misinterpret an attribute as a label",
      cursorPos: new vscode.Position(14, 9),
      expectedLabel: "",
    },
  ];

  beforeEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.env.clipboard.writeText("");
  });

  testCases.forEach(({ name, cursorPos, expectedLabel }) => {
    it(name, async () => {
      const editor = await openSourceFile(buildFilePath);

      // GIVEN
      setCursorInEditor(editor, cursorPos, cursorPos);

      // WHEN
      await vscode.commands.executeCommand("bazel.copyLabelToClipboard");

      // THEN
      assert.strictEqual(await vscode.env.clipboard.readText(), expectedLabel);
    });
  });

  describe("outside the active Bazel root", () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(async () => {
      sandbox = sinon.createSandbox();
      await vscode.workspace
        .getConfiguration("bazel.workspace")
        .update("path", "nested_module", vscode.ConfigurationTarget.Workspace);
    });

    afterEach(async () => {
      sandbox.restore();
      await vscode.workspace
        .getConfiguration("bazel.workspace")
        .update("path", undefined, vscode.ConfigurationTarget.Workspace);
    });

    it("copies nothing and tells the user why", async () => {
      // The command runs in the bundled extension, so stub the VS Code API.
      const showInfoMessage = sandbox
        .stub(vscode.window, "showInformationMessage")
        .resolves(undefined);
      const editor = await openSourceFile(buildFilePath);
      // A full label, which would be copied unchanged inside the root.
      const cursorPos = new vscode.Position(14, 20);
      setCursorInEditor(editor, cursorPos, cursorPos);

      await vscode.commands.executeCommand("bazel.copyLabelToClipboard");

      assert.strictEqual(await vscode.env.clipboard.readText(), "");
      // Opening the file may also show the workspace root hint.
      const messages = showInfoMessage
        .getCalls()
        .map((call) => call.args[0] as string);
      assert.ok(
        messages.some(
          (message) =>
            message.includes(workspacePath) &&
            message.includes("does not belong to the active Bazel workspace"),
        ),
        messages.join("\n"),
      );
    });
  });

  describe("in no Bazel workspace", () => {
    let sandbox: sinon.SinonSandbox;
    let directory: string;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
      directory = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-bazel-"));
    });

    afterEach(async () => {
      sandbox.restore();
      await vscode.commands.executeCommand("workbench.action.closeAllEditors");
      fs.rmSync(directory, { recursive: true, force: true });
    });

    it("copies nothing and says there is no Bazel workspace", async () => {
      const showInfoMessage = sandbox
        .stub(vscode.window, "showInformationMessage")
        .resolves(undefined);
      const buildFile = path.join(directory, "BUILD");
      fs.writeFileSync(buildFile, 'deps = ["//pkg:lib"]\n');
      const editor = await openSourceFile(buildFile);
      const cursorPos = new vscode.Position(0, 12);
      setCursorInEditor(editor, cursorPos, cursorPos);

      await vscode.commands.executeCommand("bazel.copyLabelToClipboard");

      assert.strictEqual(await vscode.env.clipboard.readText(), "");
      const messages = showInfoMessage
        .getCalls()
        .map((call) => call.args[0] as string);
      assert.ok(
        messages.some((message) =>
          message.includes("not in any Bazel workspace"),
        ),
        messages.join("\n"),
      );
    });
  });
});
