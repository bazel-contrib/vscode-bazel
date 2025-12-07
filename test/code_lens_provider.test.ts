import * as vscode from "vscode";
import * as assert from "assert";
import { BazelBuildCodeLensProvider } from "../src/codelens/bazel_build_code_lens_provider";
import { BazelWorkspaceInfo, IBazelCommandAdapter } from "../src/bazel";
import { blaze_query } from "../src/protos";

// Group lenses by target line number for easier assertions
interface LensInfo {
  title: string;
  command: vscode.Command;
  line: number;
  character: number;
  target: string;
}

function createMockTarget(
  name: string,
  ruleClass: string,
  line: number,
): blaze_query.Target {
  return {
    rule: {
      name,
      ruleClass,
      location: `path/to/file:${line}:1`,
    },
  } as blaze_query.Target;
}

function groupLensesByLine(lenses: vscode.CodeLens[]): Map<number, LensInfo[]> {
  const lensesByLine = new Map<number, LensInfo[]>();
  lenses.forEach((lens) => {
    const line = lens.range.start.line + 1; // Convert to 1-based line number
    if (!lensesByLine.has(line)) {
      lensesByLine.set(line, []);
    }
    if (lens.command?.title) {
      const commandAdapter = lens.command.arguments?.[0] as
        | IBazelCommandAdapter
        | undefined;
      let target = "";

      // Extract target from CodeLensCommandAdapter
      if (
        commandAdapter &&
        typeof commandAdapter.getBazelCommandOptions === "function"
      ) {
        const options = commandAdapter.getBazelCommandOptions();
        target = options.targets?.[0] || "";
      }

      lensesByLine.get(line)?.push({
        title: lens.command.title,
        command: lens.command,
        line: lens.range.start.line,
        character: lens.range.start.character,
        target,
      });
    }
  });
  return lensesByLine;
}

describe("BazelBuildCodeLensProvider", () => {
  let provider: BazelBuildCodeLensProvider;
  const mockContext = {
    subscriptions: [],
  } as vscode.ExtensionContext;

  beforeEach(() => {
    provider = new BazelBuildCodeLensProvider(mockContext);
  });

  it("generates correct code lenses for all target types & edge cases", () => {
    // GIVEN
    const workspaceInfo = {
      bazelWorkspacePath: "/workspace",
    } as BazelWorkspaceInfo;

    // Test cases include:
    // 1. Different target types (binary, library, test)
    // 2. Multiple targets with the same rule type
    // 3. Targets on the same line (testing command ordering by target name length)
    const queryResult = {
      target: [
        // Binary target (line 1)
        createMockTarget("//foo:app", "cc_binary", 1),
        // Library targets (lines 5 and 10)
        createMockTarget("//foo:lib1", "cc_library", 5),
        createMockTarget("//foo:lib2", "cc_library", 10),
        // Test targets (lines 15 and 20)
        createMockTarget("//foo:test1", "cc_test", 15),
        createMockTarget("//foo:test2", "cc_test", 20),
        // Multiple targets on the same line (line 25)
        createMockTarget("//foo:abc_helper", "cc_library", 25),
        createMockTarget("//foo:helper_abc", "cc_library", 25),
        createMockTarget("//foo:test", "cc_test", 25),
      ],
    } as unknown as blaze_query.QueryResult;

    // WHEN
    // @ts-expect-error - accessing private method for testing
    const lenses = provider.computeCodeLenses(workspaceInfo, queryResult);
    const lensesByLine = groupLensesByLine(lenses);

    // THEN
    // 1. Verify binary target (line 1) has Copy, Build, Run commands
    const binaryLenses = lensesByLine.get(1) || [];
    assert.strictEqual(
      binaryLenses.length,
      3,
      "Binary target should have 3 code lenses",
    );
    assert.deepStrictEqual(
      binaryLenses.map((l) => l.title),
      ["Copy", "Build", "Run"],
      "Binary target should have Copy, Build, Run commands",
    );
    binaryLenses.forEach((lens) => {
      assert.strictEqual(
        lens.line,
        0,
        "Binary target commands should be on line 1",
      );
      assert.strictEqual(
        lens.target,
        "//foo:app",
        "All commands should be for the binary target",
      );
    });

    // 2. Verify library targets (lines 5 and 10) have Copy, Build commands
    [5, 10].forEach((line) => {
      const libLenses = lensesByLine.get(line) || [];
      assert.strictEqual(
        libLenses.length,
        2,
        `Library target on line ${line} should have 2 code lenses`,
      );
      assert.deepStrictEqual(
        libLenses.map((l) => l.title),
        ["Copy", "Build"],
        `Library target on line ${line} should have Copy, Build commands`,
      );
      libLenses.forEach((lens) => {
        assert.strictEqual(
          lens.line,
          line - 1,
          `Library target commands should be on line ${line}`,
        );
      });
    });

    // 3. Verify test targets (lines 15 and 20) have Copy, Build, Run, Test commands
    [15, 20].forEach((line) => {
      const testLenses = lensesByLine.get(line) || [];
      assert.strictEqual(
        testLenses.length,
        4,
        `Test target on line ${line} should have 4 code lenses`,
      );
      assert.deepStrictEqual(
        testLenses.map((l) => l.title),
        ["Copy", "Build", "Test", "Run"],
        `Test target on line ${line} should have Copy, Build, Run, Test commands`,
      );
      testLenses.forEach((lens) => {
        assert.strictEqual(
          lens.line,
          line - 1,
          `Test target commands should be on line ${line}`,
        );
      });
    });

    // 4. Verify multiple targets on the same line (line 25) - now uses grouped approach
    //    - Should have 4 grouped code lenses (Copy, Build, Run, Test)
    //    - Each grouped lens should contain multiple targets ordered by length then alphabetically
    const sameLineLenses = lensesByLine.get(25) || [];
    assert.strictEqual(
      sameLineLenses.length,
      4,
      "Should have 4 grouped code lenses for multiple targets on line 25",
    );

    // Verify we have the expected command types
    const lenseTitles = sameLineLenses.map((l) => l.title).sort();
    assert.deepStrictEqual(
      lenseTitles,
      ["Build (3)", "Copy (3)", "Run", "Test"],
      "Should have grouped commands with correct counts",
    );

    // Verify each grouped command contains the correct targets in the right order
    sameLineLenses.forEach((lens) => {
      const command = lens.command;
      assert.ok(command, "Each lens should have a command");
      assert.ok(command.arguments?.[0], "Command should have arguments");

      if (lens.title.startsWith("Copy") || lens.title.startsWith("Build")) {
        // All commands now use CodeLensCommandAdapter format
        const commandAdapter = command.arguments[0] as
          | IBazelCommandAdapter
          | undefined;
        assert.ok(
          commandAdapter &&
            typeof commandAdapter.getBazelCommandOptions === "function",
          "Command should use CodeLensCommandAdapter format",
        );

        const options = commandAdapter.getBazelCommandOptions();
        assert.ok(
          Array.isArray(options.targets),
          "Command should have targets array",
        );

        if (lens.title.includes("(")) {
          // Multiple target format: Copy (3), Build (3)
          assert.deepStrictEqual(
            options.targets,
            ["//foo:abc_helper", "//foo:helper_abc", "//foo:test"],
            `${lens.title} should contain all targets ordered alphabetically`,
          );
        } else {
          // Single target format: Copy, Build
          assert.strictEqual(
            options.targets.length,
            1,
            "Single target should have exactly one target",
          );
          assert.ok(
            options.targets[0].startsWith("//foo:"),
            "Target should be from foo package",
          );
        }
      } else if (
        lens.title.startsWith("Run") ||
        lens.title.startsWith("Test")
      ) {
        // Run and Test commands now also use CodeLensCommandAdapter format
        assert.strictEqual(
          command.arguments.length,
          1,
          "Single target commands should have 1 argument",
        );
        const commandAdapter = command.arguments[0] as
          | IBazelCommandAdapter
          | undefined;
        assert.ok(
          commandAdapter &&
            typeof commandAdapter.getBazelCommandOptions === "function",
          "Command should use CodeLensCommandAdapter format",
        );

        const options = commandAdapter.getBazelCommandOptions();
        assert.deepStrictEqual(
          options.targets,
          ["//foo:test"],
          `${lens.title} should be for the test target`,
        );
      }
    });

    // Verify all commands are on the correct line (0-based line 24 = line 25 in editor)
    sameLineLenses.forEach((lens) => {
      assert.strictEqual(
        lens.line,
        24,
        `All commands for same-line targets should be on line 25, but found one on line ${lens.line + 1}`,
      );
    });
  });
});
