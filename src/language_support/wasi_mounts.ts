/**
 * Where the server's directories appear inside the WebAssembly sandbox.
 * Shared by the client, which translates URIs, and the helper process,
 * which preopens the directories under these names.
 */
export const WORKSPACE_MOUNT = "/workspace";
export const OUTPUT_BASE_MOUNT = "/output_base";
export const DATA_MOUNT = "/data";
