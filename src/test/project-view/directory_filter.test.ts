import * as assert from 'assert';
import * as vscode from 'vscode';
import { DirectoryFilter } from '../../project-view/directory_filter';
import { ProjectViewManager } from '../../project-view/project_view_manager';

suite('DirectoryFilter Multiple Directories Tests', () => {
  let directoryFilter: DirectoryFilter;
  let mockProjectViewManager: ProjectViewManager;
  let mockWorkspaceFolder: vscode.WorkspaceFolder;

  setup(() => {
    // Create mock project view manager
    mockProjectViewManager = {
      getProjectViewConfig: (workspaceFolder: vscode.WorkspaceFolder): any => null
    } as any;

    // Create mock workspace folder
    mockWorkspaceFolder = {
      uri: vscode.Uri.file('/test/workspace'),
      name: 'test-workspace',
      index: 0
    };

    directoryFilter = new DirectoryFilter(mockProjectViewManager);
  });

  teardown(() => {
    if (directoryFilter) {
      directoryFilter.dispose();
    }
  });

  suite('Multiple Directories Support', () => {
    test('should include all specified directories', () => {
      // Mock project view configuration with multiple directories
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: ['labeldex-ng', 'monorepo', 'utilities'],
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'java',
        additional_languages: []
      });

      const stats = directoryFilter.getFilteringStats(mockWorkspaceFolder);
      
      assert.strictEqual(stats.enabled, true);
      assert.strictEqual(stats.includedDirectories, 5); // 3 project dirs + 2 always included (.vscode, .vscwb)
    });

    test('should handle nested directories correctly', () => {
      // Mock project view configuration with nested directories
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: ['src/main', 'src/test', 'config/prod'],
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'java',
        additional_languages: []
      });

      // Test directory inclusion logic
      const mainResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'src');
      const configResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'config');
      const unrelatedResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'docs');

      assert.strictEqual(mainResult.included, true, 'src should be included as parent of src/main and src/test');
      assert.strictEqual(configResult.included, true, 'config should be included as parent of config/prod');
      assert.strictEqual(unrelatedResult.included, false, 'docs should be excluded as not in project view');
    });

    test('should handle mixed inclusion and exclusion', () => {
      // Mock project view configuration with both inclusions and exclusions
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: ['frontend', 'backend', 'shared', '-node_modules', '-build'],
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'javascript',
        additional_languages: []
      });

      const frontendResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'frontend');
      const backendResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'backend');
      const sharedResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'shared');
      const nodeModulesResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'node_modules');
      const buildResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'build');
      const docsResult = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'docs');

      assert.strictEqual(frontendResult.included, true, 'frontend should be included');
      assert.strictEqual(backendResult.included, true, 'backend should be included');
      assert.strictEqual(sharedResult.included, true, 'shared should be included');
      assert.strictEqual(nodeModulesResult.included, false, 'node_modules should be excluded');
      assert.strictEqual(buildResult.included, false, 'build should be excluded');
      assert.strictEqual(docsResult.included, false, 'docs should be excluded (not in project view)');
    });

    test('should handle dot directory correctly', () => {
      // Mock project view configuration with dot directory
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: ['.', '-node_modules'],
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'multi',
        additional_languages: []
      });

      const stats = directoryFilter.getFilteringStats(mockWorkspaceFolder);
      
      assert.strictEqual(stats.enabled, true);
      assert.strictEqual(stats.estimatedReduction, '0%', 'dot directory should show 0% reduction');
    });

    test('should provide accurate statistics for multiple directories', () => {
      // Mock project view configuration
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: ['app1', 'app2', 'shared'],
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'multi',
        additional_languages: []
      });

      const stats = directoryFilter.getFilteringStats(mockWorkspaceFolder);
      
      assert.strictEqual(stats.enabled, true);
      assert.strictEqual(stats.includedDirectories, 5); // 3 project dirs + 2 always included
      assert.strictEqual(stats.cacheSize, 0); // Initially empty cache
    });
  });

  suite('Integration with Build System', () => {
    test('should return all included directories', () => {
      // Mock project view configuration with multiple directories
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: ['service1', 'service2', 'lib1', 'lib2'],
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'multi',
        additional_languages: []
      });

      const includedDirs = directoryFilter.getIncludedDirectories(mockWorkspaceFolder);
      
      // Should include all project directories plus always included ones
      assert.ok(includedDirs.includes('service1'), 'service1 should be included');
      assert.ok(includedDirs.includes('service2'), 'service2 should be included'); 
      assert.ok(includedDirs.includes('lib1'), 'lib1 should be included');
      assert.ok(includedDirs.includes('lib2'), 'lib2 should be included');
      assert.ok(includedDirs.includes('.vscode'), '.vscode should always be included');
    });

    test('should exclude non-project directories', () => {
      // Mock project view configuration
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: ['src', 'test'],
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'java',
        additional_languages: []
      });

      const excludedDirs = directoryFilter.getExcludedDirectories(mockWorkspaceFolder);
      
      // Should not include project directories in excluded list
      assert.ok(!excludedDirs.includes('src'), 'src should not be in excluded list');
      assert.ok(!excludedDirs.includes('test'), 'test should not be in excluded list');
    });
  });

  suite('Performance and Caching', () => {
    test('should handle large number of directories efficiently', () => {
      // Mock project view configuration with many directories
      const manyDirectories = Array.from({ length: 50 }, (_, i) => `module${i}`);
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: manyDirectories,
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'multi',
        additional_languages: []
      });

      const startTime = Date.now();
      const stats = directoryFilter.getFilteringStats(mockWorkspaceFolder);
      const endTime = Date.now();
      
      assert.strictEqual(stats.enabled, true);
      assert.ok(endTime - startTime < 100, 'Should handle many directories quickly');
    });

    test('should cache results correctly', () => {
      // Mock project view configuration
      mockProjectViewManager.getProjectViewConfig = () => ({
        directories: ['app', 'lib'],
        targets: [],
        test_sources: [],
        derive_targets_from_directories: true,
        workspace_type: 'multi',
        additional_languages: []
      });

      // First call should populate cache
      const result1 = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'app');
      const result2 = directoryFilter.shouldIncludeDirectory(mockWorkspaceFolder, 'app');
      
      assert.strictEqual(result1.included, result2.included, 'Cached results should be consistent');
    });
  });
}); 