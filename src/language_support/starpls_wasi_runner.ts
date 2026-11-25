/**
 * Runs starpls.wasm under Node's WebAssembly System Interface.
 *
 * The extension host starts this as a child process through the language
 * client's `module` transport, with stdin and stdout as the LSP connection.
 * The workspace, the output base and the data directory are preopened
 * straight onto the disk, so the server's file operations are local system
 * calls. Going through the WebAssembly runtime extension instead would route
 * each of them through the VS Code window, which in a remote session crosses
 * the network twice per call.
 *
 * Usage: starpls-wasi-runner.js <wasm> <workspace> <output base> <data dir>
 */
import * as fs from "fs";
import { WASI } from "node:wasi";
import { DATA_MOUNT, OUTPUT_BASE_MOUNT, WORKSPACE_MOUNT } from "./wasi_mounts";

async function main(): Promise<number> {
  const [wasmPath, workspace, outputBase, dataDir] = process.argv.slice(2);
  if (!wasmPath || !workspace || !outputBase || !dataDir) {
    process.stderr.write(
      "usage: starpls-wasi-runner.js " +
        "<starpls.wasm> <workspace> <output base> <data dir>\n",
    );
    return 2;
  }
  const wasi = new WASI({
    version: "preview1",
    args: ["starpls", "server"],
    env: { RUST_LOG: process.env.RUST_LOG ?? "starpls=warn" },
    preopens: {
      [WORKSPACE_MOUNT]: workspace,
      [OUTPUT_BASE_MOUNT]: outputBase,
      [DATA_MOUNT]: dataDir,
    },
    returnOnExit: true,
  });
  const module = await WebAssembly.compile(fs.readFileSync(wasmPath));
  // `getImportObject` exists since Node 18.16; older hosts expose the same
  // namespace as `wasiImport`.
  const imports = (
    typeof (wasi as any).getImportObject === "function"
      ? wasi.getImportObject()
      : { wasi_snapshot_preview1: wasi.wasiImport }
  ) as WebAssembly.Imports;
  const instance = await WebAssembly.instantiate(module, imports);
  return wasi.start(instance);
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`starpls failed to start: ${error?.stack ?? error}\n`);
    process.exitCode = 1;
  },
);
