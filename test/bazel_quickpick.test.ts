import * as path from "path";
import * as assert from "assert";
import { guessLabelOfInterest } from "../src/bazel/bazel_quickpick";

const workspacePath = path.join(
  __dirname,
  "..",
  "..",
  "test",
  "bazel_workspace",
);
describe("Quickpick: guessLabelOfInterest", () => {
  interface TestCase {
    name: string;
    currentFilePath: string | undefined;
    currentLine: number | undefined;
    expectedLabel: string | undefined;
  }
  const testCases: TestCase[] = [
    {
      name: "should return undefined if no active file",
      currentFilePath: undefined,
      currentLine: 0,
      expectedLabel: undefined,
    },
    {
      name: "should return undefined if file not in a workspace",
      currentFilePath: "/etc/hostname",
      currentLine: 0,
      expectedLabel: undefined,
    },
    {
      name: "should return target name if file is mentioned in BUILD file",
      currentFilePath: path.join(workspacePath, "pkg1/main.py"),
      currentLine: 0,
      expectedLabel: "//pkg1:src_files",
    },
    {
      name: "should return package if file is not mentioned in BUILD file",
      currentFilePath: path.join(workspacePath, "pkg1/subfolder/lib.py"),
      currentLine: 0,
      expectedLabel: "//pkg1:",
    },
    {
      name: "should return package if BUILD and no line is given",
      currentFilePath: path.join(workspacePath, "pkg1/BUILD"),
      currentLine: undefined,
      expectedLabel: "//pkg1:",
    },
    {
      name: "should return target name if BUILD file and line in target decl.",
      currentFilePath: path.join(workspacePath, "pkg1/BUILD"),
      currentLine: 14, // Zero-indexed
      expectedLabel: "//pkg1:main",
    },
    {
      name: "should return package if BUILD file and line outside target decl.",
      currentFilePath: path.join(workspacePath, "pkg1/BUILD"),
      currentLine: 1, // Zero-indexed
      expectedLabel: "//pkg1:",
    },
  ];

  testCases.forEach(({ name, currentFilePath, currentLine, expectedLabel }) => {
    it(name, () => {
      const result = guessLabelOfInterest(currentFilePath, currentLine);
      assert.strictEqual(result, expectedLabel);
    });
  });
});
