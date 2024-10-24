import assert = require("assert");
import { IconName, Resources } from "../src/extension/resources";
import * as fs from "fs/promises";
import * as vscode from "vscode";

describe("The resources", () => {
  const resources = new Resources(
    vscode.extensions.getExtension("BazelBuild.vscode-bazel").extensionPath,
  );
  it("provides valid icon paths", async () => {
    for (const name of Object.values(IconName)) {
      await assert.doesNotReject(async () => {
        await fs.stat(resources.getIconPath(name));
      }, "invalid icon path");
    }
  });
});
