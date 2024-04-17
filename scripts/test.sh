#!/usr/bin/env bash

# Copyright 2024 The Bazel Authors. All rights reserved.
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

# If tests are eventually added for other things, this line should probably
# be replaced by just running scripts/build.sh.
js-yaml syntaxes/bazelrc.tmLanguage.yaml > syntaxes/bazelrc.tmLanguage.json

# Regression test for bazelrc grammar
vscode-tmgrammar-snap "$@" test/example.bazelrc
