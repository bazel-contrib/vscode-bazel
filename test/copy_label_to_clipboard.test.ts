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
import * as path from "path";
import * as assert from "assert";

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
  // `undefined` means nothing should be copied.
  expectedLabel: string | undefined;
}

// Chromium ignores writes of empty text, so `writeText("")` cannot reset the
// clipboard. Seed it with a marker instead.
const CLIPBOARD_MARKER = "<clipboard-marker>";

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
      expectedLabel: undefined,
    },
    {
      name: "should not misinterpret an empty line as a label",
      cursorPos: new vscode.Position(17, 0),
      expectedLabel: undefined,
    },
    {
      name: "should not misinterpret an attribute as a label",
      cursorPos: new vscode.Position(14, 9),
      expectedLabel: undefined,
    },
  ];

  beforeEach(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await vscode.env.clipboard.writeText(CLIPBOARD_MARKER);
    assert.strictEqual(
      await vscode.env.clipboard.readText(),
      CLIPBOARD_MARKER,
      "Test clipboard is not writable. On a Wayland desktop, run the tests " +
        "under X11, e.g. `env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 " +
        "xvfb-run -a npm test`.",
    );
  });

  testCases.forEach(({ name, cursorPos, expectedLabel }) => {
    it(name, async () => {
      const editor = await openSourceFile(buildFilePath);

      // GIVEN
      setCursorInEditor(editor, cursorPos, cursorPos);

      // WHEN
      await vscode.commands.executeCommand("bazel.copyLabelToClipboard");

      // THEN
      assert.strictEqual(
        await vscode.env.clipboard.readText(),
        expectedLabel ?? CLIPBOARD_MARKER,
      );
    });
  });
});
