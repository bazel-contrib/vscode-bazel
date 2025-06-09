// Copyright 2024 The Bazel Authors. All rights reserved.
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

import * as assert from "assert";
import { BazelProjectView } from "../src/project-view/bazel_project_view";

describe("BazelProjectView Tests", () => {
  let projectView: BazelProjectView;

  beforeEach(() => {
    projectView = new BazelProjectView();
  });

  afterEach(() => {
    projectView.dispose();
  });

  describe("Parsing", () => {
    it("should parse valid project view configuration", () => {
      const content = `# Project view configuration
directories:
  app/
  tests/
  -third_party/

targets:
  //app/main:binary
  //tests:all

derive_targets_from_directories: true

test_sources:
  tests/**/*_test.py
  **/*_test.java

additional_languages:
  typescript
  python
`;

      const result = projectView.parse(content);

      assert.ok(result.config);
      assert.strictEqual(result.errors.length, 0);
      
      if (result.config) {
        assert.deepStrictEqual(result.config.directories, ['app/', 'tests/', '-third_party/']);
        assert.deepStrictEqual(result.config.targets, ['//app/main:binary', '//tests:all']);
        assert.strictEqual(result.config.derive_targets_from_directories, true);
        assert.deepStrictEqual(result.config.test_sources, ['tests/**/*_test.py', '**/*_test.java']);
        assert.deepStrictEqual(result.config.additional_languages, ['typescript', 'python']);
      }
    });

    it("should handle empty file", () => {
      const result = projectView.parse("");
      
      assert.ok(result.config);
      assert.strictEqual(result.errors.length, 0);
      
      if (result.config) {
        assert.strictEqual(result.config.directories.length, 0);
        assert.strictEqual(result.config.targets.length, 0);
        assert.strictEqual(result.config.derive_targets_from_directories, false);
        assert.strictEqual(result.config.test_sources.length, 0);
        assert.strictEqual(result.config.additional_languages.length, 0);
      }
    });

    it("should handle comments", () => {
      const content = `# This is a comment
directories:
  # Another comment
  app/
# Yet another comment
targets:
  //app:main
`;

      const result = projectView.parse(content);

      assert.ok(result.config);
      assert.strictEqual(result.errors.length, 0);
      
      if (result.config) {
        assert.deepStrictEqual(result.config.directories, ['app/']);
        assert.deepStrictEqual(result.config.targets, ['//app:main']);
      }
    });

    it("should detect unknown attributes", () => {
      const content = `unknown_attribute:
  value
`;

      const result = projectView.parse(content);

      assert.strictEqual(result.errors.length, 1);
      assert.ok(result.errors[0].message.includes("Unknown attribute"));
      assert.ok(result.errors[0].suggestedFix);
    });

    it("should validate target labels", () => {
      const content = `targets:
  invalid-target
  //valid:target
`;

      const result = projectView.parse(content);

      assert.strictEqual(result.errors.length, 1);
      assert.ok(result.errors[0].message.includes("Target must start with '//'"));
      assert.ok(result.errors[0].suggestedFix?.includes("//invalid-target"));
    });

    it("should validate directory paths", () => {
      const content = `directories:
  valid/path
  ../invalid/path
`;

      const result = projectView.parse(content);

      assert.strictEqual(result.errors.length, 1);
      assert.ok(result.errors[0].message.includes("Directory path cannot contain '..'"));
    });

    it("should parse boolean values", () => {
      const content = `derive_targets_from_directories: true`;

      const result = projectView.parse(content);

      assert.ok(result.config);
      assert.strictEqual(result.config?.derive_targets_from_directories, true);

      const falseContent = `derive_targets_from_directories: false`;
      const falseResult = projectView.parse(falseContent);

      assert.strictEqual(falseResult.config?.derive_targets_from_directories, false);
    });

    it("should parse single-line arrays", () => {
      const content = `directories: [app/, tests/, lib/]`;

      const result = projectView.parse(content);

      assert.ok(result.config);
      assert.deepStrictEqual(result.config?.directories, ['app/', 'tests/', 'lib/']);
    });

    it("should handle invalid syntax", () => {
      const content = `invalid line without colon
directories:
  valid/path
invalid line again
`;

      const result = projectView.parse(content);

      assert.strictEqual(result.errors.length, 2);
      assert.ok(result.errors[0].message.includes("Invalid syntax"));
      assert.ok(result.errors[1].message.includes("Invalid syntax"));
    });

    it("should validate supported languages", () => {
      const content = `additional_languages:
  python
  unsupported_language
  typescript
`;

      const result = projectView.parse(content);

      assert.strictEqual(result.errors.length, 1);
      assert.ok(result.errors[0].message.includes("Unsupported language"));
      assert.ok(result.errors[0].suggestedFix?.includes("Supported languages"));
    });
  });

  describe("Caching", () => {
    it("should clear cache correctly", () => {
      projectView.clearCache();
      // Cache clearing should not throw errors
      assert.ok(true);
    });
  });
}); 