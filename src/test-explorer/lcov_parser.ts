import * as vscode from "vscode";
import * as fs from "fs/promises";
import * as path from "path";
import * as child_process from "child_process";
import * as which from "which";
import * as util from "util";
import { assert } from "../assert";

const execFile = util.promisify(child_process.execFile);

/**
 * Demangle JVM method names.
 *
 * See https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html#jvms-4.3.2
 */
function demangleJVMTypeNames(mangled: string): string[] | undefined {
  let arrayCnt = 0;
  const types = [] as string[];
  const flushType = (type: string) => {
    for (let i = 0; i < arrayCnt; ++i) {
      type += "[]";
    }
    types.push(type);
    arrayCnt = 0;
  };
  let idx = 0;
  while (idx < mangled.length) {
    switch (mangled[idx]) {
      case "B":
        flushType("bool");
        break;
      case "C":
        flushType("char");
        break;
      case "D":
        flushType("double");
        break;
      case "F":
        flushType("float");
        break;
      case "I":
        flushType("int");
        break;
      case "J":
        flushType("long");
        break;
      case "S":
        flushType("short");
        break;
      case "Z":
        flushType("boolean");
        break;
      case "V":
        flushType("void");
        break;
      case "[":
        ++arrayCnt;
        break;
      case "L": {
        const startIdx = idx + 1;
        while (idx < mangled.length && mangled[idx] !== ";") ++idx;
        if (idx === mangled.length) return undefined;
        const fullClassName = mangled.substring(startIdx, idx - startIdx + 1);
        const shortClassName = fullClassName.split("/").pop();
        flushType(shortClassName);
        break;
      }
      default:
        return undefined;
    }
    ++idx;
  }
  if (arrayCnt) return undefined;
  return types;
}

function demangleJVMTypeName(mangled: string): string | undefined {
  const demangled = demangleJVMTypeNames(mangled) ?? [];
  if (demangled.length !== 1) return undefined;
  return demangled[0];
}

/**
 * Demangle JVM method names.
 *
 * See https://docs.oracle.com/javase/specs/jvms/se8/html/jvms-4.html#jvms-4.3.3
 *
 * Examples:
 * ```
 *   com/example/myproject/Greeter::<clinit> ()V
 *   com/example/myproject/Greeter::<init> ()V
 *   com/example/myproject/Greeter::convertStreamToString (Ljava/io/InputStream;)Ljava/lang/String;
 *   com/example/myproject/Greeter::hello (Ljava/lang/String;)V
 *   com/example/myproject/Greeter::main ([Ljava/lang/String;)V
 * ```
 */
function demangleJVMMethodName(mangled: string): string | undefined {
  const match = mangled.match(
    // eslint-disable-next-line max-len
    /^([\p{XIDS}\p{XIDC}/]+)::([\p{XIDS}\p{XIDC}<>]+) \(([\p{XIDS}\p{XIDC};/[]*)\)([\p{XIDS}\p{XIDC};/[]*)$/u,
  );
  if (!match) return undefined;
  const fullClassName = match[1];
  const functionName = match[2];
  const mangledArgList = match[3];
  const mangledReturnType = match[4];

  const shortClassName = fullClassName.split("/").pop();
  const argList = demangleJVMTypeNames(mangledArgList);
  if (!argList) return undefined;
  const argListStr = argList.join(", ");
  const returnType = demangleJVMTypeName(mangledReturnType);
  if (!returnType) return undefined;

  return `${returnType} ${shortClassName}::${functionName}(${argListStr})`;
}

/**
 * Demangle a name by calling a filter binary (like c++filt or rustfilt)
 */
async function demangleNameUsingFilter(
  execPath: string | null,
  mangled: string,
): Promise<string | undefined> {
  if (execPath === null) return undefined;
  // c++filt needs the -n flag to properly demangle names that start with underscore
  const args = execPath.includes("c++filt") ? ["-n", mangled] : [mangled];
  const unmangled = (await execFile(execPath, args)).stdout.trim();
  // If unmangling failed, return undefined, so we can fallback to another demangler.
  if (!unmangled || unmangled === mangled) return undefined;
  return unmangled;
}

async function resolveSourceFilePath(
  baseFolder: string,
  sfPath: string,
): Promise<string> {
  // Ignore and keep the not existing paths for matching in later
  // phases.
  const resolvedSfPath = path.resolve(baseFolder, sfPath);
  // Path could be in pattern `external/<local_repository name>/...`,
  // Try resolve the symlink for <exec root>/external/<local_repository name>,
  // so that the SF path could be patched into `<real>/<path>/<to>/<repo>/...`.
  const externalRepoMatch = sfPath.match(/^external\/([^/]+)(\/.*)/);
  if (externalRepoMatch) {
    const repoName = externalRepoMatch[1];
    const rest = externalRepoMatch[2];
    try {
      const repoPath = await fs.realpath(`${baseFolder}/external/${repoName}`);
      const realSourcePath = `${repoPath}${rest}`;
      await fs.stat(realSourcePath);
      return realSourcePath;
    } catch {
      // Ignore invalid paths and fallback to original resolved one.
    }
  }
  return resolvedSfPath;
}

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
 *
 * @param baseFolder The source file entries are relative paths to baseFolder.
 * @param lcov The lcov report data in string.
 */
export async function parseLcov(
  baseFolder: string,
  lcov: string,
): Promise<BazelFileCoverage[]> {
  const cxxFiltPath = await which("c++filt", { nothrow: true });
  const rustFiltPath = await which("rustfilt", { nothrow: true });
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
    functionsByLine: Map<number, vscode.DeclarationCoverage> = new Map();
    lineCoverage: Map<number, vscode.StatementCoverage> = new Map();
    coverageByLineAndBranch: Map<number, Map<string, vscode.BranchCoverage>> =
      new Map();
  }
  const infosByFile: Map<string, FileCoverageInfo> = new Map();
  for (const block of lcov.split(/end_of_record(\n|$)/)) {
    const functionsByName: Map<string, vscode.DeclarationCoverage> = new Map();
    let info: FileCoverageInfo;
    for (let line of block.split("\n")) {
      line = line.trim();
      if (line === "") continue;
      // Split into key and value. Note that the value might contain addtional
      // `:` characters.
      const lineParts = line.split(":");
      if (lineParts.length < 2) {
        throw new Error(`Separator \`:\` missing`);
      }
      const key = lineParts.shift();
      const value = lineParts.join(":");
      switch (key) {
        case "TN": // Test name
          // Ignored. There is no way to expose this through the VSCode APIs
          break;
        case "SF": {
          // File name
          if (info !== undefined) {
            throw new Error(`Duplicated SF entry`);
          }
          const filename = await resolveSourceFilePath(baseFolder, value);
          if (!infosByFile.has(filename)) {
            infosByFile.set(filename, new FileCoverageInfo());
          }
          info = infosByFile.get(filename);
          break;
        }
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
          const startLine = Number.parseInt(match[1], 10) - 1;
          if (startLine < 0) {
            throw new Error("Negative start line in FN entry");
          }
          const funcName = match[3];
          let location: vscode.Position | vscode.Range;
          if (match[2] !== undefined) {
            const endLine = Number.parseInt(match[2], 10) - 1;
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
            // Demangle the name.
            // We must first try rustfilt before trying c++filt.
            // The Rust name mangling scheme is intentionally compatible with
            // C++ mangling. Hence, c++filt will be succesful on Rust's mangled
            // names. But rustfilt provides more readable demanglings, and hence
            // we prefer rustfilt over c++filt. For C++ mangled names, rustfilt
            // will fail and we will fallback to c++filt.
            // See https://internals.rust-lang.org/t/symbol-mangling-of-rust-vs-c/7222
            const demangled =
              demangleJVMMethodName(funcName) ??
              (await demangleNameUsingFilter(rustFiltPath, funcName)) ??
              (await demangleNameUsingFilter(cxxFiltPath, funcName)) ??
              funcName;
            info.functionsByLine.set(
              startLine,
              new vscode.DeclarationCoverage(demangled, 0, location),
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
          const coveredCount = Number.parseInt(match[1], 10);
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
          const lineNumber = Number.parseInt(parts[0], 10) - 1;
          if (lineNumber < 0) {
            throw new Error("Negative line number in DA entry");
          }
          const hitCount = Number.parseInt(parts[1], 10);
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
          // branch coverage: <line_number>,[<exception>]<block>,<branch>,<hitCount>
          // Note that the <branch> might contain commas, which requires being
          // a bit careful while parsing.
          const match = value.match(/(\d+),(e?)(\d+),(.+)/);
          if (!match) {
            throw new Error(`Invalid FNDA entry`);
          }
          const lineNumber1 = Number.parseInt(match[1], 10);
          if (lineNumber1 < 0) {
            throw new Error("Negative line number in BRDA entry");
          }
          // There might be BRDA:0 for exiting branch in report generated by
          // Coverage.py. Simply drop these entries.
          if (lineNumber1 === 0) break;
          const lineNumber = lineNumber1 - 1;
          const isException = match[2] === "e";
          const blockId = Number.parseInt(match[3], 10);
          const rest = match[4];
          const commaOffset = rest.lastIndexOf(",");
          if (commaOffset === undefined) {
            throw new Error(`Invalid BRDA entry`);
          }
          const label = rest.substring(0, commaOffset);
          const hitCountStr = rest.substring(commaOffset + 1);
          const hitCount =
            hitCountStr === "-" ? 0 : Number.parseInt(hitCountStr, 10);
          if (hitCount < 0) {
            throw new Error("Negative hit count in BRDA entry");
          }

          if (info === undefined) {
            throw new Error(`Missing filename`);
          }

          // We don't want to display coverage for exception edges.
          if (isException) break;

          // Insert into `branchByLineAndBranch`
          if (!info.coverageByLineAndBranch.has(lineNumber)) {
            info.coverageByLineAndBranch.set(lineNumber, new Map());
          }
          const coverageByBranch = info.coverageByLineAndBranch.get(lineNumber);
          const branchId = `${blockId}:${label}`;
          if (!coverageByBranch.has(branchId)) {
            coverageByBranch.set(
              branchId,
              new vscode.BranchCoverage(0, undefined, label),
            );
          }
          const branchCoverage = coverageByBranch.get(branchId);
          assert(typeof branchCoverage.executed == "number");
          branchCoverage.executed += hitCount;
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
      Array.from(info.lineCoverage.values()).map((c) => {
        assert("line" in c.location);
        const branchCoverage = info.coverageByLineAndBranch.get(
          c.location.line,
        );
        if (branchCoverage) {
          c.branches = Array.from(branchCoverage.values());
        }
        return c;
      }),
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
