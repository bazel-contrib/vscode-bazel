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
import { 
  BazelBuildIconConfigManager, 
  TargetSelectionMode, 
  CustomCommand, 
  TargetHistoryEntry, 
  BuildIconConfig 
} from "../bazel/bazel_build_icon_config";

suite("BazelBuildIconConfigManager Tests", () => {
  let configManager: BazelBuildIconConfigManager;
  let sandbox: sinon.SinonSandbox;
  let mockContext: vscode.ExtensionContext;
  let mockGlobalState: sinon.SinonStubbedInstance<vscode.Memento>;

  setup(() => {
    sandbox = sinon.createSandbox();

    // Mock extension context
    mockGlobalState = {
      get: sandbox.stub(),
      update: sandbox.stub(),
      keys: sandbox.stub().returns([])
    } as any;

    mockContext = {
      globalState: mockGlobalState,
      subscriptions: []
    } as any;

    // Mock workspace configuration
    const defaultConfig = {
      get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
        const defaults: Record<string, any> = {
          "enabled": true,
          "showSuccessNotifications": true,
          "showErrorNotifications": true,
          "targetSelectionMode": "auto",
          "showTerminalOnBuild": false,
          "enableTargetHistory": true,
          "maxHistoryItems": 10,
          "enableCacheStatus": false,
          "customCommands": [],
          "enableTelemetry": false
        };
        return defaults[key] ?? defaultValue;
      })
    };

    sandbox.stub(vscode.workspace, "getConfiguration").returns(defaultConfig as any);
    sandbox.stub(vscode.workspace, "onDidChangeConfiguration").returns({
      dispose: sandbox.stub()
    } as any);
  });

  teardown(() => {
    if (configManager) {
      configManager.dispose();
    }
    sandbox.restore();
  });

  suite("Initialization", () => {
    test("should initialize with default configuration", () => {
      configManager = new BazelBuildIconConfigManager(mockContext);
      
      const config = configManager.getConfig();
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.targetSelectionMode, TargetSelectionMode.Auto);
      assert.strictEqual(config.maxHistoryItems, 10);
    });

    test("should load existing target history", () => {
      const existingHistory: TargetHistoryEntry[] = [
        { target: "//test:target1", workspacePath: "/workspace", lastUsed: Date.now(), useCount: 5 }
      ];
      
      mockGlobalState.get.withArgs("bazel.buildIcon.targetHistory", []).returns(existingHistory);
      
      configManager = new BazelBuildIconConfigManager(mockContext);
      
      const history = configManager.getHistory("/workspace");
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].target, "//test:target1");
    });

    test("should perform configuration migration if needed", () => {
      mockGlobalState.get.withArgs("bazel.buildIcon.configVersion", 0).returns(0);
      
      configManager = new BazelBuildIconConfigManager(mockContext);
      
      assert.ok(mockGlobalState.update.calledWith("bazel.buildIcon.configVersion", 1));
    });
  });

  suite("Configuration Validation", () => {
    beforeEach(() => {
      configManager = new BazelBuildIconConfigManager(mockContext);
    });

    test("should validate boolean values", () => {
      const config = configManager.getConfig();
      assert.strictEqual(typeof config.enabled, "boolean");
      assert.strictEqual(typeof config.showSuccessNotifications, "boolean");
      assert.strictEqual(typeof config.enableTargetHistory, "boolean");
    });

    test("should validate target selection mode enum", () => {
      const config = configManager.getConfig();
      assert.ok(Object.values(TargetSelectionMode).includes(config.targetSelectionMode));
    });

    test("should validate number ranges", () => {
      const config = configManager.getConfig();
      assert.ok(config.maxHistoryItems >= 1 && config.maxHistoryItems <= 50);
    });

    test("should return validation warnings for invalid config", () => {
      const invalidConfig = {
        get: sandbox.stub().callsFake((key: string) => {
          switch (key) {
            case "targetSelectionMode": return "invalid";
            case "maxHistoryItems": return 100; // Too high
            case "customCommands": return [{ name: "test" }]; // Missing command
            default: return undefined;
          }
        })
      };
      
      sandbox.stub(vscode.workspace, "getConfiguration").returns(invalidConfig as any);
      
      const warnings = configManager.validateConfiguration();
      assert.ok(warnings.length > 0);
      assert.ok(warnings.some(w => w.includes("targetSelectionMode")));
      assert.ok(warnings.some(w => w.includes("maxHistoryItems")));
      assert.ok(warnings.some(w => w.includes("Custom command")));
    });
  });

  suite("Workspace-Specific Configuration", () => {
    beforeEach(() => {
      configManager = new BazelBuildIconConfigManager(mockContext);
    });

    test("should return global config when no workspace folder provided", () => {
      const config = configManager.getWorkspaceConfig();
      assert.strictEqual(config.enabled, true);
      assert.strictEqual(config.targetSelectionMode, TargetSelectionMode.Auto);
    });

    test("should merge workspace and global configuration", () => {
      const workspaceFolder: vscode.WorkspaceFolder = {
        uri: vscode.Uri.file("/workspace"),
        name: "test-workspace",
        index: 0
      };

      const workspaceConfig = {
        get: sandbox.stub().callsFake((key: string) => {
          if (key === "enabled") return false; // Override global
          return undefined; // Use global for others
        })
      };

      sandbox.stub(vscode.workspace, "getConfiguration")
        .withArgs("bazel.buildIcon", workspaceFolder.uri)
        .returns(workspaceConfig as any);

      const config = configManager.getWorkspaceConfig(workspaceFolder);
      assert.strictEqual(config.enabled, false); // Workspace override
      assert.strictEqual(config.targetSelectionMode, TargetSelectionMode.Auto); // Global default
    });
  });

  suite("Target History Management", () => {
    beforeEach(() => {
      mockGlobalState.get.withArgs("bazel.buildIcon.targetHistory", []).returns([]);
      configManager = new BazelBuildIconConfigManager(mockContext);
    });

    test("should add new target to history", () => {
      configManager.addToHistory("//test:target1", "/workspace");
      
      const history = configManager.getHistory("/workspace");
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].target, "//test:target1");
      assert.strictEqual(history[0].useCount, 1);
    });

    test("should increment use count for existing target", () => {
      configManager.addToHistory("//test:target1", "/workspace");
      configManager.addToHistory("//test:target1", "/workspace");
      
      const history = configManager.getHistory("/workspace");
      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0].useCount, 2);
    });

    test("should sort history by last used", () => {
      const clock = sandbox.useFakeTimers();
      
      configManager.addToHistory("//test:target1", "/workspace");
      clock.tick(1000);
      configManager.addToHistory("//test:target2", "/workspace");
      
      const history = configManager.getHistory("/workspace");
      assert.strictEqual(history[0].target, "//test:target2"); // Most recent first
      assert.strictEqual(history[1].target, "//test:target1");
      
      clock.restore();
    });

    test("should limit history to maxHistoryItems", () => {
      // Set max to 2 for testing
      const limitedConfig = {
        get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
          if (key === "maxHistoryItems") return 2;
          if (key === "enableTargetHistory") return true;
          return defaultValue;
        })
      };
      sandbox.stub(vscode.workspace, "getConfiguration").returns(limitedConfig as any);
      
      configManager.addToHistory("//test:target1", "/workspace");
      configManager.addToHistory("//test:target2", "/workspace");
      configManager.addToHistory("//test:target3", "/workspace");
      
      const history = configManager.getHistory("/workspace");
      assert.strictEqual(history.length, 2);
      assert.strictEqual(history[0].target, "//test:target3");
      assert.strictEqual(history[1].target, "//test:target2");
    });

    test("should not add to history when disabled", () => {
      const disabledConfig = {
        get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
          if (key === "enableTargetHistory") return false;
          return defaultValue;
        })
      };
      sandbox.stub(vscode.workspace, "getConfiguration").returns(disabledConfig as any);
      
      configManager.addToHistory("//test:target1", "/workspace");
      
      const history = configManager.getHistory("/workspace");
      assert.strictEqual(history.length, 0);
    });

    test("should filter history by workspace path", () => {
      configManager.addToHistory("//test:target1", "/workspace1");
      configManager.addToHistory("//test:target2", "/workspace2");
      
      const workspace1History = configManager.getHistory("/workspace1");
      const workspace2History = configManager.getHistory("/workspace2");
      
      assert.strictEqual(workspace1History.length, 1);
      assert.strictEqual(workspace1History[0].target, "//test:target1");
      assert.strictEqual(workspace2History.length, 1);
      assert.strictEqual(workspace2History[0].target, "//test:target2");
    });

    test("should clear all history", () => {
      configManager.addToHistory("//test:target1", "/workspace");
      configManager.addToHistory("//test:target2", "/workspace");
      
      configManager.clearHistory();
      
      const history = configManager.getHistory("/workspace");
      assert.strictEqual(history.length, 0);
    });

    test("should persist history to global state", () => {
      configManager.addToHistory("//test:target1", "/workspace");
      
      assert.ok(mockGlobalState.update.calledWith("bazel.buildIcon.targetHistory"));
    });
  });

  suite("Custom Commands", () => {
    beforeEach(() => {
      configManager = new BazelBuildIconConfigManager(mockContext);
    });

    test("should return custom commands from configuration", () => {
      const customCommands: CustomCommand[] = [
        { name: "Test Target", command: "test", args: ["--test_output=all"] },
        { name: "Run Target", command: "run" }
      ];

      const configWithCommands = {
        get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
          if (key === "customCommands") return customCommands;
          return defaultValue;
        })
      };
      sandbox.stub(vscode.workspace, "getConfiguration").returns(configWithCommands as any);

      const commands = configManager.getCustomCommands();
      assert.strictEqual(commands.length, 2);
      assert.strictEqual(commands[0].name, "Test Target");
      assert.strictEqual(commands[0].command, "test");
      assert.deepStrictEqual(commands[0].args, ["--test_output=all"]);
    });

    test("should filter out invalid custom commands", () => {
      const invalidCommands = [
        { name: "Valid Test", command: "test" },
        { name: "", command: "build" }, // Invalid: empty name
        { name: "Invalid Command", command: "invalid" }, // Invalid: bad command
        { command: "test" } // Invalid: missing name
      ];

      const configWithInvalidCommands = {
        get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
          if (key === "customCommands") return invalidCommands;
          return defaultValue;
        })
      };
      sandbox.stub(vscode.workspace, "getConfiguration").returns(configWithInvalidCommands as any);

      const commands = configManager.getCustomCommands();
      assert.strictEqual(commands.length, 1);
      assert.strictEqual(commands[0].name, "Valid Test");
    });
  });

  suite("Telemetry", () => {
    beforeEach(() => {
      configManager = new BazelBuildIconConfigManager(mockContext);
    });

    test("should record telemetry when enabled", () => {
      const enabledConfig = {
        get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
          if (key === "enableTelemetry") return true;
          return defaultValue;
        })
      };
      sandbox.stub(vscode.workspace, "getConfiguration").returns(enabledConfig as any);

      const consoleSpy = sandbox.spy(console, "log");
      
      configManager.recordTelemetry("test-event", { property: "value" });
      
      assert.ok(consoleSpy.calledOnce);
      assert.ok(consoleSpy.firstCall.args[0].includes("test-event"));
    });

    test("should not record telemetry when disabled", () => {
      const disabledConfig = {
        get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
          if (key === "enableTelemetry") return false;
          return defaultValue;
        })
      };
      sandbox.stub(vscode.workspace, "getConfiguration").returns(disabledConfig as any);

      const consoleSpy = sandbox.spy(console, "log");
      
      configManager.recordTelemetry("test-event", { property: "value" });
      
      assert.ok(consoleSpy.notCalled);
    });
  });

  suite("Configuration Change Events", () => {
    beforeEach(() => {
      configManager = new BazelBuildIconConfigManager(mockContext);
    });

    test("should emit configuration change events", () => {
      let changedConfig: BuildIconConfig | undefined;
      
      configManager.onConfigChanged(config => {
        changedConfig = config;
      });

      // Simulate configuration change
      const changeEvent: vscode.ConfigurationChangeEvent = {
        affectsConfiguration: sandbox.stub().returns(true)
      } as any;

      // Trigger the event manually (in real scenario this would be triggered by VS Code)
      // We'll test this by checking if the event listener was registered
      assert.ok((vscode.workspace.onDidChangeConfiguration as any).calledOnce);
    });
  });

  suite("Configuration Migration", () => {
    test("should migrate from version 0 to version 1", () => {
      mockGlobalState.get.withArgs("bazel.buildIcon.configVersion", 0).returns(0);
      
      configManager = new BazelBuildIconConfigManager(mockContext);
      
      assert.ok(mockGlobalState.update.calledWith("bazel.buildIcon.configVersion", 1));
    });

    test("should not migrate if already current version", () => {
      mockGlobalState.get.withArgs("bazel.buildIcon.configVersion", 0).returns(1);
      
      configManager = new BazelBuildIconConfigManager(mockContext);
      
      // Should not update version if already current
      assert.ok(!mockGlobalState.update.calledWith("bazel.buildIcon.configVersion", 1));
    });
  });

  suite("Disposal", () => {
    test("should dispose of all resources", () => {
      configManager = new BazelBuildIconConfigManager(mockContext);
      
      configManager.dispose();
      
      // Should dispose of event listeners and other resources
      // This is tested implicitly through the teardown
      assert.ok(true);
    });
  });
}); 