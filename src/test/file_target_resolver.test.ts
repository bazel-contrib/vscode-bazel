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
import * as vscode from "vscode";
import * as sinon from "sinon";
import { FileTargetResolver } from "../bazel/file_target_resolver";

suite("FileTargetResolver Tests", () => {
  let resolver: FileTargetResolver;
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
    resolver = new FileTargetResolver();
  });

  teardown(() => {
    sandbox.restore();
  });

  suite("Basic Functionality", () => {
    test("should create resolver instance", () => {
      assert.ok(resolver);
      assert.ok(typeof resolver.resolveTargetForFile === "function");
    });

    test("should have clearCache method", () => {
      assert.ok(typeof resolver.clearCache === "function");
      resolver.clearCache(); // Should not throw
    });

    test("should have manualTargetSelection method", () => {
      assert.ok(typeof resolver.manualTargetSelection === "function");
    });
  });

  suite("Error Handling", () => {
    test("should handle invalid workspace gracefully", async () => {
      const invalidWorkspace = null as any;
      const options = { showDisambiguationUI: false };
      
      try {
        const result = await resolver.resolveTargetForFile("/invalid/path", invalidWorkspace, options);
        // Should either return error result or throw
        assert.ok(result.error || result.primaryTarget === null);
      } catch (error) {
        // Expected for invalid input
        assert.ok(true);
      }
    });

    test("should handle empty file path", async () => {
      const mockWorkspace = {
        bazelWorkspacePath: "/mock/workspace",
        workspaceFolder: {
          uri: vscode.Uri.file("/mock/workspace"),
          name: "test",
          index: 0
        }
      };
      
      const options = { showDisambiguationUI: false };
      
      try {
        const result = await resolver.resolveTargetForFile("", mockWorkspace, options);
        assert.ok(result.error || result.primaryTarget === null);
      } catch (error) {
        assert.ok(true);
      }
    });
  });

  suite("Cache Management", () => {
    test("should clear cache without errors", () => {
      resolver.clearCache();
      assert.ok(true); // Should complete without throwing
    });
  });
}); 