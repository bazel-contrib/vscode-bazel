import assert = require("assert");
import { BazelFileCoverage, parseLcov } from "../src/test-explorer/lcov_parser";
import { readFile } from "fs/promises";
import * as path from "path";
import { DeclarationCoverage, StatementCoverage } from "vscode";

const testDir = path.join(__dirname, "../..", "test");

function parseTestLcov(lcov: string): Promise<BazelFileCoverage[]> {
  return parseLcov("/base", lcov);
}

async function parseTestLcovFile(p: string): Promise<BazelFileCoverage[]> {
  const absolutePath = path.join(testDir, p);
  const lcov = await readFile(absolutePath, { encoding: "utf-8" });
  return parseTestLcov(lcov);
}

function getCoverageForFile(
  cov: BazelFileCoverage[],
  fileName: string,
): BazelFileCoverage | undefined {
  return cov.find((c) => c.uri.fsPath === fileName);
}

function getFunctionByLine(
  cov: BazelFileCoverage,
  lineNr: number,
): DeclarationCoverage | undefined {
  for (const d of cov.details) {
    if (!(d instanceof DeclarationCoverage)) continue;
    if (!d.location) continue;
    assert("line" in d.location);
    if (d.location.line !== lineNr - 1) continue;
    return d;
  }
}

function getLineCoverageForLine(
  cov: BazelFileCoverage,
  lineNr: number,
): StatementCoverage | undefined {
  for (const d of cov.details) {
    if (!(d instanceof StatementCoverage)) continue;
    if (!d.location) continue;
    assert("line" in d.location);
    if (d.location.line !== lineNr - 1) continue;
    return d;
  }
}

describe("The lcov parser", () => {
  it("accepts an empty string", async () => {
    assert.deepEqual(await parseTestLcov(""), []);
  });

  it("accepts Linux end-of-lines", async () => {
    const coveredFiles = await parseTestLcov(
      "SF:a.cpp\nFN:1,abc\nend_of_record\n",
    );
    assert.equal(coveredFiles.length, 1);
    assert.equal(coveredFiles[0].declarationCoverage.total, 1);
  });

  it("accepts Windows end-of-lines", async () => {
    // \r\n and no final end of line
    const coveredFiles = await parseTestLcov(
      "SF:a.cpp\r\nFN:1,abc\r\nend_of_record",
    );
    assert.equal(coveredFiles.length, 1);
    assert.equal(coveredFiles[0].declarationCoverage.total, 1);
  });

  it("ignores invalid line numbers", async () => {
    assert.deepEqual(await parseTestLcov("BRDA:0,0,0,b"), []);
  });

  describe("parses Java coverage data:", () => {
    let fileCov: BazelFileCoverage;
    before(async () => {
      const coveredFiles = await parseTestLcovFile("lcov/java.lcov");
      assert.equal(coveredFiles.length, 1);
      fileCov = getCoverageForFile(
        coveredFiles,
        "/base/examples/java-native/src/main/java/com/example/myproject/" +
          "Greeter.java",
      );
      assert(fileCov !== undefined);
    });
    it("function coverage", () => {
      assert(fileCov.declarationCoverage !== undefined);
      assert.strictEqual(fileCov.declarationCoverage.total, 5);
      assert.strictEqual(fileCov.declarationCoverage.covered, 4);
    });
    it("line coverage", () => {
      assert.strictEqual(fileCov.statementCoverage.total, 15);
      assert.strictEqual(fileCov.statementCoverage.covered, 11);
    });
    it("branch coverage", () => {
      assert(fileCov.branchCoverage !== undefined);
      assert.strictEqual(fileCov.branchCoverage.total, 6);
      assert.strictEqual(fileCov.branchCoverage.covered, 3);
    });
    it("function coverage details", () => {
      const initFunc = getFunctionByLine(fileCov, 24);
      assert(initFunc !== undefined);
      assert.equal(initFunc.name, "void Greeter::<init>()");
      assert.equal(initFunc.executed, 1);
      const convertFunc = getFunctionByLine(fileCov, 28);
      assert.equal(
        convertFunc.name,
        "String Greeter::convertStreamToString(InputStream)",
      );
      assert.equal(convertFunc.executed, 0);
    });
    it("line coverage details", () => {
      assert.equal(getLineCoverageForLine(fileCov, 37).executed, 1);
      assert.equal(getLineCoverageForLine(fileCov, 38).executed, 0);
      assert.equal(getLineCoverageForLine(fileCov, 40).executed, 1);
    });
    it("branch coverage data", () => {
      const branchCoverage = getLineCoverageForLine(fileCov, 37).branches;
      assert.equal(branchCoverage.length, 2);
      assert.equal(branchCoverage[0].executed, 1);
      assert.equal(branchCoverage[1].executed, 0);
    });
  });

  describe("parses C++ coverage data", () => {
    let fileCov: BazelFileCoverage;
    before(async () => {
      const coveredFiles = await parseTestLcovFile("lcov/cpp.lcov");
      assert.equal(coveredFiles.length, 1);
      fileCov = coveredFiles[0];
    });
    it("function coverage", () => {
      assert(fileCov.declarationCoverage !== undefined);
      assert.strictEqual(fileCov.declarationCoverage.total, 50);
      assert.strictEqual(fileCov.declarationCoverage.covered, 50);
    });
    it("line coverage", () => {
      assert.strictEqual(fileCov.statementCoverage.total, 510);
      assert.strictEqual(fileCov.statementCoverage.covered, 505);
    });
    it("branch coverage", () => {
      assert(fileCov.branchCoverage !== undefined);
      assert.strictEqual(fileCov.branchCoverage.total, 2560);
      assert.strictEqual(fileCov.branchCoverage.covered, 843);
    });
    it("function coverage details", () => {
      const initFunc = getFunctionByLine(fileCov, 71);
      assert(initFunc !== undefined);
      assert.equal(initFunc.name, "_ZN5blaze10RcFileTest5SetUpEv");
      assert.equal(initFunc.executed, 34);
    });
    it("line coverage details", () => {
      assert.equal(getLineCoverageForLine(fileCov, 176).executed, 1);
      assert.equal(getLineCoverageForLine(fileCov, 178).executed, 0);
      assert.equal(getLineCoverageForLine(fileCov, 193).executed, 4);
    });
    it("branch coverage data", () => {
      const branchCoverage = getLineCoverageForLine(fileCov, 479).branches;
      assert.equal(branchCoverage.length, 2);
      assert.equal(branchCoverage[0].executed, 1);
      assert.equal(branchCoverage[1].executed, 0);
      const branchCoverage2 = getLineCoverageForLine(fileCov, 481).branches;
      assert.equal(branchCoverage2.length, 12);
    });
  });

  describe("parses Rust coverage data", () => {
    let fileCov: BazelFileCoverage;
    before(async () => {
      const coveredFiles = await parseTestLcovFile("lcov/rust.lcov");
      assert.equal(coveredFiles.length, 2);
      fileCov = getCoverageForFile(coveredFiles, "/base/util/label/label.rs");
      assert(fileCov !== undefined);
    });
    it("function coverage", () => {
      assert(fileCov.declarationCoverage !== undefined);
      assert.strictEqual(fileCov.declarationCoverage.total, 22);
      assert.strictEqual(fileCov.declarationCoverage.covered, 18);
    });
    it("line coverage", () => {
      assert.strictEqual(fileCov.statementCoverage.total, 460);
      assert.strictEqual(fileCov.statementCoverage.covered, 426);
    });
    it("branch coverage", () => {
      // Rust has no branch coverage data, as of writing this test case.
      // Also see https://github.com/rust-lang/rust/issues/79649
      assert(fileCov.branchCoverage === undefined);
    });
    it("function coverage details", () => {
      const consumeFunc = getFunctionByLine(fileCov, 230);
      assert(consumeFunc !== undefined);
      assert.equal(
        consumeFunc.name,
        "_RNCNvCscQvVXOS7Ja3_5label20consume_package_name0B3_",
      );
      assert.equal(consumeFunc.executed, 2);
    });
    it("line coverage details", () => {
      assert.equal(getLineCoverageForLine(fileCov, 88).executed, 45);
      assert.equal(getLineCoverageForLine(fileCov, 89).executed, 31);
    });
  });

  describe("parses Go coverage data", () => {
    let fileCov: BazelFileCoverage;
    before(async () => {
      const coveredFiles = await parseTestLcovFile("lcov/go.lcov");
      assert.equal(coveredFiles.length, 7);
      fileCov = getCoverageForFile(coveredFiles, "/base/config/config.go");
      assert(fileCov !== undefined);
    });
    it("function coverage", () => {
      assert(fileCov.declarationCoverage === undefined);
    });
    it("line coverage", () => {
      assert.strictEqual(fileCov.statementCoverage.total, 410);
      assert.strictEqual(fileCov.statementCoverage.covered, 133);
    });
    it("branch coverage", () => {
      // Go has no branch coverage data.
      assert(fileCov.branchCoverage === undefined);
    });
    it("line coverage details", () => {
      assert.equal(getLineCoverageForLine(fileCov, 265).executed, 1);
      assert.equal(getLineCoverageForLine(fileCov, 266).executed, 0);
    });
  });
});
