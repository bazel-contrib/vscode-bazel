// Copyright 2026 The Bazel Authors. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Holds the extension's tool registry. Kept apart from tool_registry.ts, and
// importing it as a type only, so that low-level modules (configuration,
// features) can reach the registry without importing the tool lookup, which
// would create an import cycle through bazel_utils.
import type { ExternalToolRegistry } from "./tool_registry";

let registry: ExternalToolRegistry | undefined;

/** The extension's tool registry; `undefined` before activation. */
export function getToolRegistry(): ExternalToolRegistry | undefined {
  return registry;
}

/**
 * Replaces the registry. Used by `registerToolRegistry` and by tests.
 */
export function setToolRegistry(
  newRegistry: ExternalToolRegistry | undefined,
): void {
  registry = newRegistry;
}
