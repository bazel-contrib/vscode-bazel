import * as path from "path";
import * as fs from "fs";
import * as assert from "assert";
import {
  getBuildFileLineWithSourceFilePath,
  getTargetNameAtBuildFileLocation,
} from "../src/bazel/bazel_utils";

const workspacePath = path.join(
  __dirname,
  "..",
  "..",
  "test",
  "bazel_workspace",
);
const packagePath = path.join(workspacePath, "pkg2", "sub-pkg");
describe("Bazel Utils: getBuildFileLineWithSourceFilePath", () => {
  interface TestCase {
    name: string;
    buildFilePath: string;
    sourceFilePath: string;
    expectedLineNumber: number | undefined;
  }
  const testCases: TestCase[] = [
    {
      name: "should find file in package root",
      buildFilePath: path.join(packagePath, "BUILD"),
      sourceFilePath: path.join(packagePath, "mydata.txt"),
      expectedLineNumber: 8, // Zero-indexed
    },
    {
      name: "should find file in a packages subfolder",
      buildFilePath: path.join(packagePath, "BUILD"),
      sourceFilePath: path.join(packagePath, "subfolder", "foobar.txt"),
      expectedLineNumber: 4, // Zero-indexed
    },
    {
      name: "should return undefined if no match found",
      buildFilePath: path.join(packagePath, "BUILD"),
      sourceFilePath: path.join(packagePath, "does_not_exist.txt"),
      expectedLineNumber: undefined,
    },
  ];

  testCases.forEach(
    ({ name, buildFilePath, sourceFilePath, expectedLineNumber }) => {
      it(name, () => {
        const result = getBuildFileLineWithSourceFilePath(
          buildFilePath,
          sourceFilePath,
        );
        assert.strictEqual(result, expectedLineNumber);
      });
    },
  );
});

describe("Bazel Utils: getTargetNameAtBuildFileLocation", () => {
  interface TestCase {
    name: string;
    buildFilePath: string;
    lineToMatch: string;
    expectedlineNumber: number;
    expectedTargetName: string | undefined;
  }
  const testCases: TestCase[] = [
    {
      name: "should find target name when on target name attribute",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: '    name = "foobar",',
      expectedlineNumber: 3, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should find target name when on other attribute",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: '    srcs = ["subfolder/foobar.txt"],',
      expectedlineNumber: 4, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should find target name when on opening parenthesis",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: "filegroup(",
      expectedlineNumber: 2, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should find target name when on closing parenthesis",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: ")",
      expectedlineNumber: 11, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should find target name when inside glob paranthesis",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: '            "mydata.txt",',
      expectedlineNumber: 8, // Zero-indexed
      expectedTargetName: "foobar",
    },
    {
      name: "should return undefined if outside target definition",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: "# Empty line",
      expectedlineNumber: 1, // Zero-indexed
      expectedTargetName: undefined,
    },
    {
      name: "should return undefined if at end of file",
      buildFilePath: path.join(packagePath, "BUILD"),
      lineToMatch: "# EOF",
      expectedlineNumber: 12, // Zero-indexed
      expectedTargetName: undefined,
    },
  ];

  testCases.forEach(
    ({
      name,
      buildFilePath,
      lineToMatch,
      expectedlineNumber,
      expectedTargetName,
    }) => {
      it(name, () => {
        const buildFileContent = fs
          .readFileSync(buildFilePath, "utf8")
          .trim()
          .replace(/\r\n|\r/g, "\n")
          .split("\n");
        const lineNumber = buildFileContent.indexOf(lineToMatch);
        assert.strictEqual(lineNumber, expectedlineNumber);
        const result = getTargetNameAtBuildFileLocation(
          buildFilePath,
          lineNumber,
        );
        assert.strictEqual(result, expectedTargetName);
      });
    },
  );
});
