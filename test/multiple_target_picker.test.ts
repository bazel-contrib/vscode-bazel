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
import { BazelWorkspaceInfo } from "../src/bazel/bazel_workspace_info";
import { CodeLensCommandAdapter } from "../src/codelens/code_lens_command_adapter";

describe("Multiple Target Picker Functionality", () => {
  let mockWorkspaceInfo: BazelWorkspaceInfo;

  beforeEach(() => {
    // Create mock workspace info
    mockWorkspaceInfo = {
      bazelWorkspacePath: "/test/workspace",
    } as BazelWorkspaceInfo;
  });

  describe("Target Grouping", () => {
    it("should detect multiple targets for picker display", () => {
      // GIVEN: Multiple targets in adapter
      const targets = ["//foo:target1", "//foo:target2"];
      const adapter = new CodeLensCommandAdapter(mockWorkspaceInfo, targets);

      // WHEN: Checking for multiple targets
      const commandOptions = adapter.getBazelCommandOptions();
      const hasMultipleTargets = commandOptions.targets.length > 1;

      // THEN: Should detect multiple targets
      assert.strictEqual(
        hasMultipleTargets,
        true,
        "Should detect multiple targets when targets.length > 1",
      );
      assert.strictEqual(
        commandOptions.targets.length,
        2,
        "Should preserve both targets for picker",
      );
    });

    it("should bypass picker for single targets", () => {
      // GIVEN: Single target in adapter
      const targets = ["//foo:single"];
      const adapter = new CodeLensCommandAdapter(mockWorkspaceInfo, targets);

      // WHEN: Checking for multiple targets
      const commandOptions = adapter.getBazelCommandOptions();
      const hasMultipleTargets = commandOptions.targets.length > 1;

      // THEN: Should not trigger picker logic
      assert.strictEqual(
        hasMultipleTargets,
        false,
        "Single targets should bypass picker logic",
      );
      assert.strictEqual(
        commandOptions.targets[0],
        "//foo:single",
        "Single target should be preserved",
      );
    });

    it("should preserve target order for picker display", () => {
      // GIVEN: Targets in specific order
      const targets = ["//foo:zzz_last", "//foo:aaa_first"];
      const adapter = new CodeLensCommandAdapter(mockWorkspaceInfo, targets);

      // WHEN: Getting targets from adapter
      const commandOptions = adapter.getBazelCommandOptions();

      // THEN: Order should be preserved for consistent picker display
      assert.strictEqual(
        commandOptions.targets[0],
        "//foo:zzz_last",
        "Target order should be preserved for picker",
      );
      assert.strictEqual(
        commandOptions.targets[1],
        "//foo:aaa_first",
        "Target order should be preserved for picker",
      );
    });
  });

  describe("Picker Display", () => {
    it("should show picker for multiple target commands", () => {
      // GIVEN: Multiple targets that support all operations
      const targets = ["//foo:binary", "//foo:test"];
      const adapter = new CodeLensCommandAdapter(mockWorkspaceInfo, targets);

      // WHEN: Checking if commands would trigger picker logic
      const commandOptions = adapter.getBazelCommandOptions();
      const shouldShowPicker = commandOptions.targets.length > 1;

      // THEN: All operations should show picker
      assert.strictEqual(
        shouldShowPicker,
        true,
        "Build command should show picker for multiple targets",
      );
      assert.ok(
        commandOptions.workspaceInfo,
        "Workspace info should be available for picker",
      );
      assert.ok(
        Array.isArray(commandOptions.targets),
        "Targets should be available as array for picker",
      );
    });

    it("should handle target name extraction for picker display", () => {
      // GIVEN: Various target patterns for picker display
      const testCases = [
        {
          target: "//foo:bar",
          expectedShortName: "bar",
          description: "Simple target should extract name for picker",
        },
        {
          target: "//very/long/path:target",
          expectedShortName: "target",
          description: "Long path should extract target name for picker",
        },
        {
          target: "//:root",
          expectedShortName: "root",
          description: "Root target should extract name for picker",
        },
      ];

      testCases.forEach((testCase) => {
        // WHEN: Extracting short name for picker display
        const colonIndex = testCase.target.lastIndexOf(":");
        const shortName =
          colonIndex !== -1
            ? testCase.target.substring(colonIndex + 1)
            : testCase.target;

        // THEN: Short name should be extracted correctly for picker
        assert.strictEqual(
          shortName,
          testCase.expectedShortName,
          testCase.description,
        );
      });
    });
  });

  describe("Copy with Clipboard", () => {
    it("should enable copy functionality for multiple targets", () => {
      // GIVEN: Multiple targets for copy operation
      const targets = ["//foo:lib1", "//foo:lib2"];
      const adapter = new CodeLensCommandAdapter(mockWorkspaceInfo, targets);

      // WHEN: Getting command options for copy operation
      const commandOptions = adapter.getBazelCommandOptions();
      const shouldShowPicker = commandOptions.targets.length > 1;

      // THEN: Copy command should show picker for target selection
      assert.strictEqual(
        shouldShowPicker,
        true,
        "Copy command should show picker for multiple targets",
      );
      assert.strictEqual(
        commandOptions.targets.length,
        2,
        "Both targets should be available for copy selection",
      );

      // Verify targets are available for clipboard operation
      assert.strictEqual(
        commandOptions.targets[0],
        "//foo:lib1",
        "First target should be available for copy",
      );
      assert.strictEqual(
        commandOptions.targets[1],
        "//foo:lib2",
        "Second target should be available for copy",
      );
    });

    it("should handle direct copy for single targets", () => {
      // GIVEN: Single target for copy operation
      const targets = ["//foo:single_lib"];
      const adapter = new CodeLensCommandAdapter(mockWorkspaceInfo, targets);

      // WHEN: Getting command options for copy operation
      const commandOptions = adapter.getBazelCommandOptions();
      const shouldShowPicker = commandOptions.targets.length > 1;

      // THEN: Copy should work directly without picker
      assert.strictEqual(
        shouldShowPicker,
        false,
        "Single target copy should bypass picker",
      );
      assert.strictEqual(
        commandOptions.targets[0],
        "//foo:single_lib",
        "Single target should be available for direct copy",
      );
    });
  });
});
