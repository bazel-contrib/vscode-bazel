#!/usr/bin/env bash

# Copyright 2018 The Bazel Authors. All rights reserved.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

set -eu

# Move into the top-level directory of the project.
cd "$(dirname "${BASH_SOURCE[0]}")/.." > /dev/null

# Only regenerate the .js and .t.ds file if the protos have changed (i.e.,
# it's a fresh checkout or update_protos.sh has been executed again and
# deleted the old generated files). This shaves several seconds off the
# extension's build time.
if [[ ! -f src/protos/protos.js ]] ; then
  sed -e "s#^#src/protos/#" src/protos/protos_list.txt | \
      xargs npx pbjs -t static-module -o src/protos/protos.js
fi
if [[ ! -f src/protos/protos.d.ts ]] ; then
  npx pbts -o src/protos/protos.d.ts src/protos/protos.js
fi

# Convert yaml language definition to json form requred by vscode.
npx js-yaml syntaxes/bazelrc.tmLanguage.yaml > syntaxes/bazelrc.tmLanguage.json

# Compile the rest of the project.
npx tsc "$@" -p ./
