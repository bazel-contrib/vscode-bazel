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

import { IconName } from "../extension/resources";
import { blaze_query } from "../protos";

/**
 * Icons to use for specific rule classes.
 *
 * This mapping is checked before the general suffix checks for
 * binary/library/test rules, so it can be used to override specific rules, or
 * rules that don't have the standard suffixes. For example, Apple
 * application/extension/framework targets are shown with folder-like icons
 * because those bundles are conceptually folders.
 */
const SPECIFIC_RULE_CLASS_ICONS: Record<string, IconName> = {
  android_binary: IconName.ANDROID_BINARY,
  apple_bundle_import: IconName.RESOURCE_BUNDLE,
  apple_resource_bundle: IconName.RESOURCE_BUNDLE,
  config_setting: IconName.CONFIG_SETTING,
  filegroup: IconName.FILEGROUP,
  genrule: IconName.GENRULE,
  ios_application: IconName.APPLE_APPLICATION,
  ios_extension: IconName.APPLE_EXECUTABLE_BUNDLE,
  ios_framework: IconName.APPLE_FRAMEWORK,
  macos_application: IconName.APPLE_APPLICATION,
  macos_bundle: IconName.APPLE_EXECUTABLE_BUNDLE,
  macos_extension: IconName.APPLE_EXECUTABLE_BUNDLE,
  objc_bundle: IconName.RESOURCE_BUNDLE,
  objc_bundle_library: IconName.RESOURCE_BUNDLE,
  objc_framework: IconName.APPLE_FRAMEWORK,
  objc_import: IconName.LIBRARY,
  proto_library: IconName.PROTO,
  swift_c_module: IconName.LIBRARY,
  swift_import: IconName.LIBRARY,
  test_suite: IconName.TEST_SUITE,
  tvos_application: IconName.APPLE_APPLICATION,
  tvos_extension: IconName.APPLE_EXECUTABLE_BUNDLE,
  watchos_application: IconName.APPLE_APPLICATION,
  watchos_extension: IconName.APPLE_EXECUTABLE_BUNDLE,
};

/**
 * Returns a string or {@code vscode.ThemeIcon} representing the icon to display
 * for the given build target.
 *
 * @param rule The {@code QueriedRule} representing the build target.
 */
export function getBazelRuleIcon(
  target: blaze_query.ITarget,
): IconName | undefined {
  const ruleClass = target.rule?.ruleClass ?? "";
  const iconName = SPECIFIC_RULE_CLASS_ICONS[ruleClass];
  if (iconName) {
    return iconName;
  } else if (ruleClass.endsWith("_binary")) {
    return IconName.BINARY;
  } else if (ruleClass.endsWith("_proto_library")) {
    return IconName.PROTO;
  } else if (ruleClass.endsWith("_library")) {
    return IconName.LIBRARY;
  } else if (ruleClass.endsWith("_test")) {
    return IconName.TEST;
  }
  return undefined;
}
