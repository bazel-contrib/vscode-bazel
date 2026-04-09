// Copyright 2018 The Bazel Authors. All rights reserved.
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

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Move into the top-level directory of the project.
const root = path.resolve(__dirname, "..");
process.chdir(root);

// Only regenerate the .js and .d.ts file if the protos have changed (i.e.,
// it's a fresh checkout or update_protos.sh has been executed again and
// deleted the old generated files). This shaves several seconds off the
// extension's build time.
if (!fs.existsSync("src/protos/protos.js")) {
  const protoFiles = fs
    .readFileSync("src/protos/protos_list.txt", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `src/protos/${line}`);
  execSync(
    `npx pbjs -t static-module -o src/protos/protos.js ${protoFiles.join(" ")}`,
    {
      stdio: "inherit",
    },
  );
}

if (!fs.existsSync("src/protos/protos.d.ts")) {
  execSync("npx pbts -o src/protos/protos.d.ts src/protos/protos.js", {
    stdio: "inherit",
  });
}

// Convert yaml language definition to json form required by vscode.
const json = execSync("npx js-yaml syntaxes/bazelrc.tmLanguage.yaml", {
  encoding: "utf8",
});
fs.writeFileSync(
  path.join(root, "syntaxes/bazelrc.tmLanguage.json"),
  json.endsWith("\n") ? json : json + "\n",
  { encoding: "utf8" },
);
