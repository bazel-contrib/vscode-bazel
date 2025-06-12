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

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as assert from 'assert';
import { ProjectViewManager } from '../../project-view/project_view_manager';
import { DirectoryFilterService } from '../../project-view/directory_filter_service';

suite('Directory Filter E2E Tests', () => {
  let testWorkspace: vscode.WorkspaceFolder;
  let projectViewManager: ProjectViewManager;
  let directoryFilterService: DirectoryFilterService;
  let testDirectories: string[];
  let projectViewPath: vscode.Uri;
  let originalFileExcludes: any;

  suiteSetup(async function() {
    this.timeout(30000); // 30 seconds for setup
    
    // Create a temporary test workspace
    const tempDir = path.join(__dirname, '..', '..', '..', 'test', 'temp-workspace-e2e');
    
    // Clean up any existing test workspace
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // Create test workspace structure
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Create test directories
    testDirectories = ['app', 'lib', 'tests', 'docs', 'config', 'scripts'];
    for (const dir of testDirectories) {
      const dirPath = path.join(tempDir, dir);
      fs.mkdirSync(dirPath, { recursive: true });
      
      // Create a dummy file in each directory
      fs.writeFileSync(path.join(dirPath, 'BUILD.bazel'), `# BUILD file for ${dir}`);
      fs.writeFileSync(path.join(dirPath, 'dummy.txt'), `Content for ${dir}`);
    }
    
    // Create .vscwb directory and .bazelproject file
    const vscwbDir = path.join(tempDir, '.vscwb');
    fs.mkdirSync(vscwbDir, { recursive: true });
    
    projectViewPath = vscode.Uri.file(path.join(vscwbDir, '.bazelproject'));
    
    // Initial .bazelproject content with only 'app' directory
    const initialContent = `# Test project view
directories:
  app

targets:
  //app/...

derive_targets_from_directories: true
`;
    fs.writeFileSync(projectViewPath.fsPath, initialContent);
    
    // Open the workspace in VS Code
    const workspaceUri = vscode.Uri.file(tempDir);
    testWorkspace = { uri: workspaceUri, name: 'test-workspace', index: 0 };
    
    // Initialize services
    projectViewManager = ProjectViewManager.getInstance();
    directoryFilterService = DirectoryFilterService.getInstance();
    
    // Store original file excludes
    originalFileExcludes = vscode.workspace.getConfiguration('files', workspaceUri).get('exclude');
    
    console.log('Test workspace created at:', tempDir);
    console.log('Test directories:', testDirectories);
  });

  suiteTeardown(async function() {
    this.timeout(10000);
    
    try {
      // Restore original file excludes
      if (originalFileExcludes && testWorkspace) {
        const config = vscode.workspace.getConfiguration('files', testWorkspace.uri);
        await config.update('exclude', originalFileExcludes, vscode.ConfigurationTarget.WorkspaceFolder);
      }
      
      // Clean up test workspace
      const tempDir = path.join(__dirname, '..', '..', '..', 'test', 'temp-workspace-e2e');
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.log('Cleanup error (non-critical):', error);
    }
  });

  setup(async function() {
    this.timeout(5000);
    
    // Clear any cached data
    directoryFilterService.getDirectoryFilter().clearCache();
    
    // Reset to initial state - only 'app' directory
    const initialContent = `# Test project view
directories:
  app

targets:
  //app/...

derive_targets_from_directories: true
`;
    fs.writeFileSync(projectViewPath.fsPath, initialContent);
    
    // Refresh project view
    await projectViewManager.refreshProjectView(testWorkspace);
    
    // Wait for changes to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  teardown(async function() {
    this.timeout(3000);
    
    // Disable directory filtering after each test
    await directoryFilterService.disableDirectoryFiltering();
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  suite('Directory Addition Tests', () => {
    test('should show new directory in explorer when added to .bazelproject', async function() {
      this.timeout(15000);
      
      // Step 1: Enable directory filtering
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Verify initial state - only 'app' should be visible
      let fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('Initial file excludes:', fileExcludes);
      
      // Verify that 'lib' is excluded initially
      assert.strictEqual(fileExcludes?.lib, true, 'lib should be excluded initially');
      assert.strictEqual(fileExcludes?.app, undefined, 'app should not be excluded');
      
      // Step 3: Add 'lib' directory to .bazelproject
      const updatedContent = `# Test project view
directories:
  app
  lib

targets:
  //app/...
  //lib/...

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, updatedContent);
      
      // Step 4: Wait for file system watcher to detect change
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 5: Verify 'lib' is now visible (not excluded)
      fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('Updated file excludes after adding lib:', fileExcludes);
      
      assert.strictEqual(fileExcludes?.lib, undefined, 'lib should not be excluded anymore');
      assert.strictEqual(fileExcludes?.app, undefined, 'app should still not be excluded');
      
      // Step 6: Verify other directories are still excluded
      assert.strictEqual(fileExcludes?.tests, true, 'tests should still be excluded');
      assert.strictEqual(fileExcludes?.docs, true, 'docs should still be excluded');
      
      console.log('✅ Test passed: lib directory is now visible after adding to .bazelproject');
    });

    test('should handle multiple directory additions', async function() {
      this.timeout(15000);
      
      // Enable directory filtering
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add multiple directories at once
      const multiDirContent = `# Test project view
directories:
  app
  lib
  tests
  config

targets:
  //app/...
  //lib/...
  //tests/...
  //config/...

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, multiDirContent);
      
      // Wait for changes to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify all specified directories are visible
      const fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('File excludes after adding multiple directories:', fileExcludes);
      
      // These should NOT be excluded (should be visible)
      assert.strictEqual(fileExcludes?.app, undefined, 'app should be visible');
      assert.strictEqual(fileExcludes?.lib, undefined, 'lib should be visible');
      assert.strictEqual(fileExcludes?.tests, undefined, 'tests should be visible');
      assert.strictEqual(fileExcludes?.config, undefined, 'config should be visible');
      
      // These should still be excluded
      assert.strictEqual(fileExcludes?.docs, true, 'docs should be excluded');
      assert.strictEqual(fileExcludes?.scripts, true, 'scripts should be excluded');
      
      console.log('✅ Test passed: Multiple directories are visible after adding to .bazelproject');
    });

    test('should show all directories when "." is used', async function() {
      this.timeout(15000);
      
      // Enable directory filtering
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Use "." to include all directories
      const allDirsContent = `# Test project view
directories:
  .

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, allDirsContent);
      
      // Wait for changes to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify no directories are excluded (except performance excludes)
      const fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('File excludes with "." directory:', fileExcludes);
      
      // All our test directories should be visible
      for (const dir of testDirectories) {
        assert.strictEqual(fileExcludes?.[dir], undefined, `${dir} should be visible when using "." in project view`);
      }
      
      console.log('✅ Test passed: All directories are visible when using "." in .bazelproject');
    });
  });

  suite('Directory Removal Tests', () => {
    test('should hide directory from explorer when removed from .bazelproject', async function() {
      this.timeout(15000);
      
      // Step 1: Start with multiple directories
      const multiDirContent = `# Test project view
directories:
  app
  lib
  tests

targets:
  //app/...
  //lib/...
  //tests/...

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, multiDirContent);
      
      // Step 2: Enable directory filtering
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 3: Verify initial state - all three directories should be visible
      let fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      assert.strictEqual(fileExcludes?.app, undefined, 'app should be visible initially');
      assert.strictEqual(fileExcludes?.lib, undefined, 'lib should be visible initially');
      assert.strictEqual(fileExcludes?.tests, undefined, 'tests should be visible initially');
      
      // Step 4: Remove 'lib' directory from .bazelproject
      const reducedContent = `# Test project view
directories:
  app
  tests

targets:
  //app/...
  //tests/...

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, reducedContent);
      
      // Step 5: Wait for changes to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 6: Verify 'lib' is now hidden (excluded)
      fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('File excludes after removing lib:', fileExcludes);
      
      assert.strictEqual(fileExcludes?.lib, true, 'lib should be excluded now');
      assert.strictEqual(fileExcludes?.app, undefined, 'app should still be visible');
      assert.strictEqual(fileExcludes?.tests, undefined, 'tests should still be visible');
      
      console.log('✅ Test passed: lib directory is hidden after removing from .bazelproject');
    });

    test('should handle removing all directories except one', async function() {
      this.timeout(15000);
      
      // Start with multiple directories
      const multiDirContent = `# Test project view
directories:
  app
  lib
  tests
  config

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, multiDirContent);
      
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Remove all but one directory
      const singleDirContent = `# Test project view
directories:
  app

targets:
  //app/...

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, singleDirContent);
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify only 'app' is visible
      const fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('File excludes after keeping only app:', fileExcludes);
      
      assert.strictEqual(fileExcludes?.app, undefined, 'app should be visible');
      assert.strictEqual(fileExcludes?.lib, true, 'lib should be excluded');
      assert.strictEqual(fileExcludes?.tests, true, 'tests should be excluded');
      assert.strictEqual(fileExcludes?.config, true, 'config should be excluded');
      
      console.log('✅ Test passed: Only app directory is visible after removing others');
    });
  });

  suite('Integration with VS Code Explorer', () => {
    test('should integrate properly with VS Code file explorer commands', async function() {
      this.timeout(20000);
      
      // Enable directory filtering
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test that VS Code explorer refresh commands work
      try {
        await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
        console.log('✅ VS Code explorer refresh command executed successfully');
      } catch (error) {
        console.log('❌ VS Code explorer refresh failed:', error);
        throw error;
      }
      
      // Test directory filter debug command
      try {
        await vscode.commands.executeCommand('bazel.debugDirectoryFiltering');
        console.log('✅ Debug directory filtering command executed successfully');
      } catch (error) {
        console.log('❌ Debug command failed:', error);
        throw error;
      }
      
      // Test manual refresh command
      try {
        await vscode.commands.executeCommand('bazel.refreshDirectoryFilter');
        console.log('✅ Manual directory filter refresh executed successfully');
      } catch (error) {
        console.log('❌ Manual refresh failed:', error);
        throw error;
      }
    });

    test('should maintain file excludes consistency', async function() {
      this.timeout(15000);
      
      // Get initial excludes
      const initialExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude');
      console.log('Initial excludes before filtering:', initialExcludes);
      
      // Enable directory filtering
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get excludes after enabling
      const filteredExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude');
      console.log('Excludes after enabling filtering:', filteredExcludes);
      
      // Disable directory filtering
      await directoryFilterService.disableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get excludes after disabling
      const restoredExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude');
      console.log('Excludes after disabling filtering:', restoredExcludes);
      
      // They should match the initial state (or be empty if no initial excludes)
      if (initialExcludes) {
        assert.deepStrictEqual(restoredExcludes, initialExcludes, 'Excludes should be restored to initial state');
      } else {
        // If no initial excludes, restored should be empty object or undefined
        const isEmpty = restoredExcludes === undefined || Object.keys(restoredExcludes as any).length === 0;
        assert.ok(isEmpty, 'Excludes should be empty when no initial excludes existed');
      }
      
      console.log('✅ Test passed: File excludes consistency maintained');
    });
  });

  suite('Specific Directory to "." Transition', () => {
    test('should properly transition from specific directories to "." and restore full codebase', async function() {
      this.timeout(20000);
      
      console.log('🧪 Testing critical feature: specific directories → "." transition');
      
      // Step 1: Enable directory filtering
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 2: Start with only 'app' directory (others should be excluded)
      const specificDirContent = `# Test project view - specific directory
directories:
  app

targets:
  //app/...

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, specificDirContent);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 3: Verify specific directory filtering is working
      let fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('File excludes with specific directory (app only):', fileExcludes);
      
      // App should be visible, others should be excluded
      assert.strictEqual(fileExcludes?.app, undefined, 'app should be visible with specific directory filtering');
      assert.strictEqual(fileExcludes?.lib, true, 'lib should be excluded with specific directory filtering');
      assert.strictEqual(fileExcludes?.tests, true, 'tests should be excluded with specific directory filtering');
      assert.strictEqual(fileExcludes?.docs, true, 'docs should be excluded with specific directory filtering');
      assert.strictEqual(fileExcludes?.config, true, 'config should be excluded with specific directory filtering');
      assert.strictEqual(fileExcludes?.scripts, true, 'scripts should be excluded with specific directory filtering');
      
      console.log('✅ Step 3 passed: Specific directory filtering working correctly');
      
      // Step 4: **CRITICAL TEST** - Change to "." (should show ALL directories)
      const allDirsContent = `# Test project view - all directories
directories:
  .

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, allDirsContent);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 5: Verify ALL directories are now visible (excludes should be restored to original)
      fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('File excludes after changing to "." (should show all directories):', fileExcludes);
      
      // **CRITICAL ASSERTIONS**: All test directories should now be visible
      for (const dir of testDirectories) {
        assert.strictEqual(fileExcludes?.[dir], undefined, 
          `${dir} should be visible when using "." - this is the core feature being tested!`);
      }
      
      console.log('✅ Step 5 CRITICAL TEST passed: "." successfully restored full codebase visibility');
      
      // Step 6: Verify we can go back to specific directories
      const backToSpecificContent = `# Test project view - back to specific
directories:
  app
  lib

targets:
  //app/...
  //lib/...

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, backToSpecificContent);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Step 7: Verify specific filtering works again
      fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('File excludes after going back to specific directories:', fileExcludes);
      
      assert.strictEqual(fileExcludes?.app, undefined, 'app should be visible again');
      assert.strictEqual(fileExcludes?.lib, undefined, 'lib should be visible again');
      assert.strictEqual(fileExcludes?.tests, true, 'tests should be excluded again');
      assert.strictEqual(fileExcludes?.docs, true, 'docs should be excluded again');
      
      console.log('✅ Step 7 passed: Can successfully return to specific directory filtering');
      
      console.log('🎉 INTEGRATION TEST PASSED: Full transition cycle works correctly!');
    });

    test('should handle "." with explicit exclusions', async function() {
      this.timeout(15000);
      
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test "." with explicit exclusions using "-" prefix
      const dotWithExclusionsContent = `# Test project view - dot with exclusions
directories:
  .
  -tests
  -docs

derive_targets_from_directories: true
`;
      fs.writeFileSync(projectViewPath.fsPath, dotWithExclusionsContent);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const fileExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('File excludes with "." and explicit exclusions:', fileExcludes);
      
      // Most directories should be visible
      assert.strictEqual(fileExcludes?.app, undefined, 'app should be visible with "." and exclusions');
      assert.strictEqual(fileExcludes?.lib, undefined, 'lib should be visible with "." and exclusions');
      assert.strictEqual(fileExcludes?.config, undefined, 'config should be visible with "." and exclusions');
      assert.strictEqual(fileExcludes?.scripts, undefined, 'scripts should be visible with "." and exclusions');
      
      // Explicitly excluded directories should be hidden
      assert.strictEqual(fileExcludes?.tests, true, 'tests should be excluded with explicit "-tests"');
      assert.strictEqual(fileExcludes?.docs, true, 'docs should be excluded with explicit "-docs"');
      
      console.log('✅ Test passed: "." with explicit exclusions works correctly');
    });
  });

  suite('Performance and Reliability', () => {
    test('should handle rapid directory changes without issues', async function() {
      this.timeout(20000);
      
      await directoryFilterService.enableDirectoryFiltering();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Rapidly change directories multiple times
      const changes = [
        ['app'],
        ['app', 'lib'],
        ['app', 'lib', 'tests'],
        ['app', 'tests'],
        ['lib', 'config'],
        ['.'], // All directories
        ['app'] // Back to single
      ];
      
      for (let i = 0; i < changes.length; i++) {
        const dirs = changes[i];
        const content = `# Test project view - change ${i + 1}
directories:
${dirs.map(dir => `  ${dir}`).join('\n')}

derive_targets_from_directories: true
`;
        
        console.log(`Applying change ${i + 1}:`, dirs);
        fs.writeFileSync(projectViewPath.fsPath, content);
        
        // Short wait between changes
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Wait for final state to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify final state (should have only 'app' visible)
      const finalExcludes = vscode.workspace.getConfiguration('files', testWorkspace.uri).get('exclude') as Record<string, boolean>;
      console.log('Final file excludes after rapid changes:', finalExcludes);
      
      assert.strictEqual(finalExcludes?.app, undefined, 'app should be visible');
      assert.strictEqual(finalExcludes?.lib, true, 'lib should be excluded');
      
      console.log('✅ Test passed: Rapid directory changes handled correctly');
    });
  });
}); 