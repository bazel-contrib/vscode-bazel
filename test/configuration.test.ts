import * as assert from "assert";
import * as vscode from "vscode";
import { getConfigurationWithDefault } from "../src/extension/configuration";

describe("Configuration", () => {
  describe("getConfigurationWithDefault", () => {
    afterEach(async () => {
      // Reset configuration to defaults
      await vscode.workspace
        .getConfiguration("bazel")
        .update("executable", undefined, vscode.ConfigurationTarget.Workspace);

      await vscode.workspace
        .getConfiguration("bazel.commandLine")
        .update(
          "startupOptions",
          undefined,
          vscode.ConfigurationTarget.Workspace,
        );
    });

    it("should return the default value when configuration is not set", () => {
      const result = getConfigurationWithDefault<string>("bazel", "executable");
      assert.strictEqual(result, "bazel");
    });

    it("should return the set value when configuration is set", async () => {
      await vscode.workspace
        .getConfiguration("bazel")
        .update(
          "executable",
          "custom-bazel",
          vscode.ConfigurationTarget.Workspace,
        );
      const result = getConfigurationWithDefault<string>("bazel", "executable");
      assert.strictEqual(result, "custom-bazel");
    });

    it("should throw an error when there is no default value", () => {
      assert.throws(() => {
        getConfigurationWithDefault<string>("nonexistent", "key");
      }, /No default value for configuration nonexistent\.key/);
    });

    it("should return default for array configuration", () => {
      const result = getConfigurationWithDefault<string[]>(
        "bazel.commandLine",
        "startupOptions",
      );
      assert.deepStrictEqual(result, []);
    });

    it("should return set value for array configuration", async () => {
      await vscode.workspace
        .getConfiguration("bazel.commandLine")
        .update(
          "startupOptions",
          ["--option"],
          vscode.ConfigurationTarget.Workspace,
        );
      const result = getConfigurationWithDefault<string[]>(
        "bazel.commandLine",
        "startupOptions",
      );
      assert.deepStrictEqual(result, ["--option"]);
    });
  });
});
