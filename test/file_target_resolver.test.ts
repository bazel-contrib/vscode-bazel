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

import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { FileTargetResolver } from "../src/bazel/file_target_resolver";
import { BazelWorkspaceInfo } from "../src/bazel/bazel_workspace_info";

describe("FileTargetResolver BUILD File Tests", () => {
  let resolver: FileTargetResolver;

  beforeEach(() => {
    resolver = new FileTargetResolver();
  });

  function createMockWorkspaceInfo(workspacePath: string): BazelWorkspaceInfo {
    const mockUri = vscode.Uri.file(workspacePath);
    const mockWorkspaceFolder: vscode.WorkspaceFolder = {
      uri: mockUri,
      name: "test",
      index: 0
    };
    
    // Use reflection to create BazelWorkspaceInfo since constructor is private
    const workspaceInfo = Object.create(BazelWorkspaceInfo.prototype);
    Object.defineProperty(workspaceInfo, 'bazelWorkspacePath', {
      value: workspacePath,
      writable: false,
      enumerable: true,
      configurable: false
    });
    Object.defineProperty(workspaceInfo, 'workspaceFolder', {
      value: mockWorkspaceFolder,
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    return workspaceInfo;
  }

  it("should handle BUILD.bazel files without throwing unsupported file type error", async () => {
    const mockWorkspace = createMockWorkspaceInfo("/mock/workspace");
    const options = { showDisambiguationUI: false };
    
    // This should not throw "Unsupported file type: .bazel" error
    const result = await resolver.resolveTargetForFile("/mock/workspace/BUILD.bazel", mockWorkspace, options);
    
    // We expect it to not have the specific "Unsupported file type" error
    assert.ok(!result.error || !result.error.includes("Unsupported file type: .bazel"));
  });

  it("should handle BUILD files without throwing unsupported file type error", async () => {
    const mockWorkspace = createMockWorkspaceInfo("/mock/workspace");
    const options = { showDisambiguationUI: false };
    
    // This should not throw "Unsupported file type" error
    const result = await resolver.resolveTargetForFile("/mock/workspace/BUILD", mockWorkspace, options);
    
    // We expect it to not have the specific "Unsupported file type" error
    assert.ok(!result.error || !result.error.includes("Unsupported file type"));
  });

  it("should still treat regular .bazel files as unsupported", async () => {
    const mockWorkspace = createMockWorkspaceInfo("/mock/workspace");
    const options = { showDisambiguationUI: false };
    
    // Regular .bazel files (not BUILD.bazel) should still be unsupported
    const result = await resolver.resolveTargetForFile("/mock/workspace/some_file.bazel", mockWorkspace, options);
    
    // Should have the "Unsupported file type: .bazel" error for non-BUILD files
    assert.ok(result.error && result.error.includes("Unsupported file type: .bazel"));
  });
}); 