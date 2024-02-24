import * as vscode from "vscode";
import * as path from "path";
import { assert } from "../assert";

/**
 * Coverage data from a Bazel run.
 *
 * For Bazel, we parse the detailed coverage data eagerly and store it as part
 * of the FileCoverage instance.
 */
export class BazelFileCoverage extends vscode.FileCoverage {
  // The coverage details
  details?: vscode.FileCoverageDetail[];

  // Construct the coverage info from the detailed coverage information
  static fromDetails(
    uri: vscode.Uri,
    details: vscode.FileCoverageDetail[],
  ): BazelFileCoverage {
    const cov = vscode.FileCoverage.fromDetails(
      uri,
      details,
    ) as BazelFileCoverage;
    cov.details = details;
    return cov;
  }
}

/**
 * Parses the LCOV coverage info into VS Code's representation
 */
export function parseLcov(
  baseFolder: string,
  lcov: string,
): BazelFileCoverage[] {
  lcov = lcov.replaceAll("\r\n", "\n");

  // Documentation of the lcov format:
  // * https://manpages.debian.org/unstable/lcov/geninfo.1.en.html
  // * https://github.com/linux-test-project/lcov/blob/70a44f841bd99826d6f9e6df89897d2a6b9b2fe0/lib/lcovutil.pm#L6690
  //
  // Following the logic from `lcovutil.pm`, functions are identified by
  // filename and line. The same line number might be associated with multiple
  // function names.
  //
  // Note that line numbers in LCOV files seem to be 1-based, while line
  // numbers for VS Code need to be 0-based.
  class FileCoverageInfo {
    functionsByLine: Map<Number, vscode.DeclarationCoverage> = new Map();
    lineCoverage: Map<Number, vscode.StatementCoverage> = new Map();
  }
  const infosByFile: Map<string, FileCoverageInfo> = new Map();
  for (let block of lcov.split(/end_of_record(\n|$)/)) {
    let functionsByName: Map<string, vscode.DeclarationCoverage> = new Map();
    let info: FileCoverageInfo;
    for (let line of block.split("\n")) {
      line = line.trim();
      if (line === "") continue;
      // Split into key and value. Note that the value might contain addtional
      // `:` characters.
      const parts = line.split(":");
      if (parts.length < 2) {
        throw new Error(`Separator \`:\` missing`);
      }
      const key = parts.shift();
      const value = parts.join(":");
      switch (key) {
        case "TN": // Test name
          // Ignored. There is no way to expose this through the VSCode APIs
          break;
        case "SF":
          // File name
          if (info !== undefined) {
            throw new Error(`Duplicated SF entry`);
          }
          let filename = path.resolve(baseFolder, value);
          if (!infosByFile.has(filename)) {
            infosByFile.set(filename, new FileCoverageInfo());
          }
          info = infosByFile.get(filename);
          break;
        case "FN": {
          // Line number, <End Line Number>, Function name
          // Note that the function name could also contain a comma.
          const match = value.match(/^(\d+),(?:(\d+),)?(.*)$/);
          if (!match) {
            throw new Error(`Invalid FN entry`);
          }
          if (info === undefined) {
            throw new Error(`Missing filename`);
          }
          const startLine = Number.parseInt(match[1]) - 1;
          if (startLine < 0) {
            throw new Error("Negative start line in FN entry");
          }
          const funcName = match[3];
          let location: vscode.Position | vscode.Range;
          if (match[2] !== undefined) {
            const endLine = Number.parseInt(match[2]) - 1;
            if (endLine < startLine) {
              throw new Error("End line < start line in FN entry");
            }
            location = new vscode.Range(
              new vscode.Position(startLine, 0),
              new vscode.Position(endLine, 0),
            );
          } else {
            location = new vscode.Position(startLine, 0);
          }
          if (!info.functionsByLine.has(startLine)) {
            // TODO: For Java, C++ and Rust the function names should be demangled.
            // https://internals.rust-lang.org/t/symbol-mangling-of-rust-vs-c/7222
            // https://github.com/rust-lang/rustc-demangle
            // https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html#jvms-4.3.3
            //
            // Tested with:
            // * Go -> no function names, only line coverage
            // * C++ -> mangled names
            // * Java -> mangled names
            // * Rust -> mangled names
            // Not tested with Python, Swift, Kotlin etc.
            info.functionsByLine.set(
              startLine,
              new vscode.DeclarationCoverage(funcName, 0, location),
            );
          }
          functionsByName.set(funcName, info.functionsByLine.get(startLine));
          break;
        }
        case "FNDA": {
          // Function coverage: <execution count>,<function name>"
          // Note that the funciton name could also contain commas.
          const match = value.match(/^(\d+),(.*)$/);
          if (!match) {
            throw new Error(`Invalid FNDA entry`);
          }
          const coveredCount = Number.parseInt(match[1]);
          const funcName = match[2];
          const functionDef = functionsByName.get(funcName);
          if (functionDef === undefined) {
            throw new Error(
              `Coverage data for undeclared function \`${funcName}\``,
            );
          }
          if (coveredCount < 0) {
            throw new Error("Negative coverage count in FNDA entry");
          }
          assert(typeof functionDef.executed == "number");
          functionDef.executed += coveredCount;
          break;
        }
        case "FNF": // Functions found
        case "FNH": // Functions hit
          // Ignored. Reconstructed from FN entries
          break;
        case "DA": {
          // line number, hit count, [checksum]
          const parts = value.split(",");
          if (parts.length < 2 || parts.length > 3) {
            throw new Error("Invalid DA entry");
          }
          const lineNumber = Number.parseInt(parts[0]) - 1;
          if (lineNumber < 0) {
            throw new Error("Negative line number in DA entry");
          }
          const hitCount = Number.parseInt(parts[1]);
          if (hitCount < 0) {
            throw new Error("Negative hit count in DA entry");
          }
          if (info === undefined) {
            throw new Error(`Missing filename`);
          }
          if (!info.lineCoverage.has(lineNumber)) {
            info.lineCoverage.set(
              lineNumber,
              new vscode.StatementCoverage(
                hitCount,
                new vscode.Position(lineNumber, 0),
              ),
            );
          } else {
            const coverageEntry = info.lineCoverage.get(lineNumber);
            assert(typeof coverageEntry.executed == "number");
            coverageEntry.executed += hitCount;
          }
          break;
        }
        case "LF": // Lines found
        case "LH": // Lines hit
          // Ignored. Reconstructed from DA entries
          break;
        case "BRDA": {
          // branch coverage: <line_number>,[<exception>]<block>,<branch>,<taken>
          const match = value.match(/(\d+),(e?)(\d+),(.+)/);
          if (!match) {
            throw new Error(`Invalid FNDA entry`);
          }
          // TODO: Add support for branch coverage
          break;
        }
        case "BRF": // branches found
        case "BRH": // branches hit
          // Ignored. Reconstructed from BRDA entries
          break;
        default:
          throw new Error(`Unknown LCOV statement: ${key}`);
      }
    }
  }

  const fileCoverages = [] as BazelFileCoverage[];
  for (const [fileName, info] of infosByFile.entries()) {
    let detailedCoverage = [] as vscode.FileCoverageDetail[];
    detailedCoverage = detailedCoverage.concat(
      Array.from(info.functionsByLine.values()),
    );
    detailedCoverage = detailedCoverage.concat(
      Array.from(info.lineCoverage.values()),
    );
    fileCoverages.push(
      BazelFileCoverage.fromDetails(
        vscode.Uri.file(fileName),
        detailedCoverage,
      ),
    );
  }
  return fileCoverages;
}
