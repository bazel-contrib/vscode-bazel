import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { BazelQuery } from "../src/bazel/bazel_query";
import { blaze_query } from "../src/protos";

describe("BazelQuery", () => {
  const workspacePath = path.join(
    __dirname,
    "..",
    "..",
    "test",
    "bazel_workspace",
  );

  async function setQueryOptionsConfig(
    packages?: string[],
    targets?: string[],
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration("bazel");
    if (packages !== undefined) {
      await config.update("queryOptions.packages", packages);
    }
    if (targets !== undefined) {
      await config.update("queryOptions.targets", targets);
    }
  }

  beforeEach(async () => {
    // Reset config before each test
    await setQueryOptionsConfig([], []);
  });

  afterEach(async () => {
    // Reset config after each test
    await setQueryOptionsConfig([], []);
  });

  describe("queryTargets", () => {
    it("should merge config options with additionalOptions", async function () {
      this.timeout(10000);
      await setQueryOptionsConfig(undefined, ["--keep_going"]);

      const query = new BazelQuery("bazel", workspacePath);
      let capturedOptions: string[] = [];

      // Mock the run method to capture options
      // @ts-expect-error - accessing protected method for testing
      const originalRun = query.run.bind(query);
      // @ts-expect-error - accessing protected method for testing
      query.run = async (options: string[]) => {
        capturedOptions = options;
        // Return a minimal valid QueryResult proto
        const result = blaze_query.QueryResult.create({
          target: [],
        });
        return Buffer.from(blaze_query.QueryResult.encode(result).finish());
      };

      await query.queryTargets("//...", {
        additionalOptions: ["--output=json"],
      });

      // Verify config options come before additionalOptions
      const queryIndex = capturedOptions.indexOf("//...");
      const keepGoingIndex = capturedOptions.indexOf("--keep_going");
      const outputJsonIndex = capturedOptions.indexOf("--output=json");

      assert.ok(queryIndex >= 0, "Query should be in options");
      assert.ok(keepGoingIndex >= 0, "Config option should be in options");
      assert.ok(outputJsonIndex >= 0, "Additional option should be in options");
      assert.ok(
        keepGoingIndex < outputJsonIndex,
        "Config options should come before additionalOptions",
      );
    });

    it("should use empty array when config is not set", async function () {
      this.timeout(10000);
      await setQueryOptionsConfig(undefined, []);

      const query = new BazelQuery("bazel", workspacePath);
      let capturedOptions: string[] = [];

      // @ts-expect-error - accessing protected method for testing
      const originalRun = query.run.bind(query);
      // @ts-expect-error - accessing protected method for testing
      query.run = async (options: string[]) => {
        capturedOptions = options;
        const result = blaze_query.QueryResult.create({
          target: [],
        });
        return Buffer.from(blaze_query.QueryResult.encode(result).finish());
      };

      await query.queryTargets("//...", {
        additionalOptions: ["--output=json"],
      });

      // Verify only additionalOptions are present (no config options)
      const keepGoingIndex = capturedOptions.indexOf("--keep_going");
      const outputJsonIndex = capturedOptions.indexOf("--output=json");

      assert.strictEqual(
        keepGoingIndex,
        -1,
        "Config option should not be present",
      );
      assert.ok(outputJsonIndex >= 0, "Additional option should be present");
    });
  });

  describe("queryPackages", () => {
    it("should merge config options with additionalOptions", async function () {
      this.timeout(10000);
      await setQueryOptionsConfig(["--keep_going"], undefined);

      const query = new BazelQuery("bazel", workspacePath);
      let capturedOptions: string[] = [];

      // Mock the run method to capture options
      // @ts-expect-error - accessing protected method for testing
      const originalRun = query.run.bind(query);
      // @ts-expect-error - accessing protected method for testing
      query.run = async (options: string[]) => {
        capturedOptions = options;
        // Return empty result
        return Buffer.from("");
      };

      await query.queryPackages("//...", {
        additionalOptions: ["--output=json"],
      });

      // Verify config options come before additionalOptions
      const queryIndex = capturedOptions.indexOf("//...");
      const keepGoingIndex = capturedOptions.indexOf("--keep_going");
      const outputJsonIndex = capturedOptions.indexOf("--output=json");

      assert.ok(queryIndex >= 0, "Query should be in options");
      assert.ok(keepGoingIndex >= 0, "Config option should be in options");
      assert.ok(outputJsonIndex >= 0, "Additional option should be in options");
      assert.ok(
        keepGoingIndex < outputJsonIndex,
        "Config options should come before additionalOptions",
      );
    });

    it("should use empty array when config is not set", async function () {
      this.timeout(10000);
      await setQueryOptionsConfig([], undefined);

      const query = new BazelQuery("bazel", workspacePath);
      let capturedOptions: string[] = [];

      // @ts-expect-error - accessing protected method for testing
      const originalRun = query.run.bind(query);
      // @ts-expect-error - accessing protected method for testing
      query.run = async (options: string[]) => {
        capturedOptions = options;
        return Buffer.from("");
      };

      await query.queryPackages("//...", {
        additionalOptions: ["--output=json"],
      });

      // Verify only additionalOptions are present (no config options)
      const keepGoingIndex = capturedOptions.indexOf("--keep_going");
      const outputJsonIndex = capturedOptions.indexOf("--output=json");

      assert.strictEqual(
        keepGoingIndex,
        -1,
        "Config option should not be present",
      );
      assert.ok(outputJsonIndex >= 0, "Additional option should be present");
    });
  });
});
