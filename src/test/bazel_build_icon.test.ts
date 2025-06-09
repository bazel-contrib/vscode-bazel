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
import * as vscode from "vscode";
import * as sinon from "sinon";
import { BazelBuildIcon, IconState, IconStateManager } from "../bazel/bazel_build_icon";

suite("BazelBuildIcon Tests", () => {
  let buildIcon: BazelBuildIcon;
  let sandbox: sinon.SinonSandbox;
  let statusBarCreateStub: sinon.SinonStub;
  let statusBarItem: any;

  setup(() => {
    sandbox = sinon.createSandbox();
    
    // Mock status bar item
    statusBarItem = {
      text: "",
      tooltip: "",
      backgroundColor: undefined,
      color: undefined,
      command: "",
      show: sandbox.stub(),
      hide: sandbox.stub(),
      dispose: sandbox.stub()
    };

    statusBarCreateStub = sandbox.stub(vscode.window, "createStatusBarItem").returns(statusBarItem);
    
    // Mock workspace configuration
    const configStub = {
      get: sandbox.stub().callsFake((key: string, defaultValue?: any) => {
        switch (key) {
          case "enabled": return true;
          case "showSuccessNotifications": return true;
          case "showErrorNotifications": return true;
          default: return defaultValue;
        }
      })
    };
    sandbox.stub(vscode.workspace, "getConfiguration").returns(configStub as any);

    buildIcon = new BazelBuildIcon();
  });

  teardown(() => {
    buildIcon.dispose();
    sandbox.restore();
  });

  suite("Initialization", () => {
    test("should create status bar item with correct alignment and priority", () => {
      assert.ok(statusBarCreateStub.calledOnce);
      assert.ok(statusBarCreateStub.calledWith(vscode.StatusBarAlignment.Left, 100));
    });

    test("should start in idle state", () => {
      assert.strictEqual(buildIcon.getState(), IconState.Idle);
    });

    test("should show status bar item on initialization", () => {
      assert.ok(statusBarItem.show.calledOnce);
    });

    test("should set initial display properties correctly", () => {
      assert.strictEqual(statusBarItem.text, "$(tools) Bazel");
      assert.strictEqual(statusBarItem.tooltip, "Click to build current file with Bazel");
      assert.strictEqual(statusBarItem.command, "bazel.buildCurrentFile");
    });
  });

  suite("State Management", () => {
    test("should transition from idle to building", () => {
      buildIcon.setState(IconState.Building);
      assert.strictEqual(buildIcon.getState(), IconState.Building);
    });

    test("should transition from building to success", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Success);
      assert.strictEqual(buildIcon.getState(), IconState.Success);
    });

    test("should transition from building to error", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Error);
      assert.strictEqual(buildIcon.getState(), IconState.Error);
    });

    test("should reject invalid state transitions", () => {
      const consoleSpy = sandbox.spy(console, "warn");
      buildIcon.setState(IconState.Success); // Invalid: idle -> success
      
      assert.strictEqual(buildIcon.getState(), IconState.Idle);
      assert.ok(consoleSpy.calledOnce);
    });

    test("should allow transition to disabled from any state", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Disabled);
      assert.strictEqual(buildIcon.getState(), IconState.Disabled);
    });
  });

  suite("Progress Animation", () => {
    let clock: sinon.SinonFakeTimers;

    setup(() => {
      clock = sandbox.useFakeTimers();
    });

    teardown(() => {
      clock.restore();
    });

    test("should start progress animation when entering building state", () => {
      buildIcon.setState(IconState.Building);
      
      // Initial frame should be set
      assert.ok(statusBarItem.text.includes("⠋"));
      
      // Advance time and check animation frame changes
      clock.tick(100);
      assert.ok(statusBarItem.text.includes("⠙"));
      
      clock.tick(100);
      assert.ok(statusBarItem.text.includes("⠹"));
    });

    test("should stop progress animation when leaving building state", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Success);
      
      // Animation should stop
      assert.strictEqual(statusBarItem.text, "$(check) Build Success");
    });

    test("should cycle through all animation frames", () => {
      buildIcon.setState(IconState.Building);
      
      const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      
      for (let i = 0; i < frames.length; i++) {
        assert.ok(statusBarItem.text.includes(frames[i]));
        clock.tick(100);
      }
      
      // Should cycle back to first frame
      assert.ok(statusBarItem.text.includes(frames[0]));
    });
  });

  suite("Visual Display", () => {
    test("should set correct text and colors for idle state", () => {
      buildIcon.setState(IconState.Idle);
      
      assert.strictEqual(statusBarItem.text, "$(tools) Bazel");
      assert.strictEqual(statusBarItem.tooltip, "Click to build current file with Bazel");
      assert.strictEqual(statusBarItem.backgroundColor, undefined);
      assert.strictEqual(statusBarItem.color, undefined);
    });

    test("should set correct text and colors for success state", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Success);
      
      assert.strictEqual(statusBarItem.text, "$(check) Build Success");
      assert.strictEqual(statusBarItem.tooltip, "Build completed successfully");
      assert.ok(statusBarItem.backgroundColor);
      assert.ok(statusBarItem.color);
    });

    test("should set correct text and colors for error state", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Error);
      
      assert.strictEqual(statusBarItem.text, "$(error) Build Failed");
      assert.strictEqual(statusBarItem.tooltip, "Build failed - click for details");
      assert.ok(statusBarItem.backgroundColor);
      assert.ok(statusBarItem.color);
    });

    test("should set correct text and colors for disabled state", () => {
      buildIcon.setState(IconState.Disabled);
      
      assert.strictEqual(statusBarItem.text, "$(tools) Bazel (Unavailable)");
      assert.strictEqual(statusBarItem.tooltip, "Bazel is not available in this workspace");
      assert.strictEqual(statusBarItem.backgroundColor, undefined);
      assert.ok(statusBarItem.color);
    });

    test("should hide icon when disabled in configuration", () => {
      const configStub = sandbox.stub(vscode.workspace, "getConfiguration").returns({
        get: sandbox.stub().returns(false) // enabled = false
      } as any);
      
      buildIcon.refresh();
      assert.ok(statusBarItem.hide.called);
    });
  });

  suite("Auto Timeout", () => {
    let clock: sinon.SinonFakeTimers;

    setup(() => {
      clock = sandbox.useFakeTimers();
    });

    teardown(() => {
      clock.restore();
    });

    test("should auto-transition from success to idle after timeout", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Success, 3000);
      
      assert.strictEqual(buildIcon.getState(), IconState.Success);
      
      clock.tick(3000);
      assert.strictEqual(buildIcon.getState(), IconState.Idle);
    });

    test("should auto-transition from error to idle after timeout", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Error, 5000);
      
      assert.strictEqual(buildIcon.getState(), IconState.Error);
      
      clock.tick(5000);
      assert.strictEqual(buildIcon.getState(), IconState.Idle);
    });

    test("should clear existing timeout when setting new state", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Success, 3000);
      buildIcon.setState(IconState.Building); // Should clear timeout
      
      clock.tick(3000);
      assert.strictEqual(buildIcon.getState(), IconState.Building);
    });
  });

  suite("Notifications", () => {
    let showInfoStub: sinon.SinonStub;
    let showErrorStub: sinon.SinonStub;

    setup(() => {
      showInfoStub = sandbox.stub(vscode.window, "showInformationMessage").resolves();
      showErrorStub = sandbox.stub(vscode.window, "showErrorMessage").resolves();
    });

    test("should show success notification when transitioning from building to success", () => {
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Success);
      
      assert.ok(showInfoStub.calledOnce);
      assert.ok(showInfoStub.firstCall.args[0].includes("Build completed successfully"));
    });

    test("should show error notification when transitioning to error", () => {
      buildIcon.setState(IconState.Error);
      
      assert.ok(showErrorStub.calledOnce);
      assert.ok(showErrorStub.firstCall.args[0].includes("Build failed"));
    });

    test("should not show success notification if disabled in config", () => {
      const configStub = {
        get: sandbox.stub().callsFake((key: string) => {
          if (key === "showSuccessNotifications") return false;
          return true;
        })
      };
      sandbox.stub(vscode.workspace, "getConfiguration").returns(configStub as any);
      
      buildIcon.setState(IconState.Building);
      buildIcon.setState(IconState.Success);
      
      assert.ok(showInfoStub.notCalled);
    });

    test("should not show error notification if disabled in config", () => {
      const configStub = {
        get: sandbox.stub().callsFake((key: string) => {
          if (key === "showErrorNotifications") return false;
          return true;
        })
      };
      sandbox.stub(vscode.workspace, "getConfiguration").returns(configStub as any);
      
      buildIcon.setState(IconState.Error);
      
      assert.ok(showErrorStub.notCalled);
    });
  });

  suite("Disposal", () => {
    test("should dispose status bar item", () => {
      buildIcon.dispose();
      assert.ok(statusBarItem.dispose.calledOnce);
    });

    test("should clear any active timeouts", () => {
      const clock = sandbox.useFakeTimers();
      
      buildIcon.setState(IconState.Success, 3000);
      buildIcon.dispose();
      
      clock.tick(3000);
      // Should not throw or change state after disposal
      
      clock.restore();
    });

    test("should stop progress animation", () => {
      const clock = sandbox.useFakeTimers();
      
      buildIcon.setState(IconState.Building);
      buildIcon.dispose();
      
      clock.tick(100);
      // Animation should not continue after disposal
      
      clock.restore();
    });
  });
});

suite("IconStateManager Tests", () => {
  let stateManager: IconStateManager;
  let clock: sinon.SinonFakeTimers;

  setup(() => {
    stateManager = new IconStateManager();
    clock = sinon.useFakeTimers();
  });

  teardown(() => {
    stateManager.dispose();
    clock.restore();
  });

  test("should start in disabled state", () => {
    assert.strictEqual(stateManager.getCurrentState(), IconState.Disabled);
  });

  test("should allow valid transitions", () => {
    assert.ok(stateManager.transitionTo(IconState.Idle));
    assert.ok(stateManager.transitionTo(IconState.Building));
    assert.ok(stateManager.transitionTo(IconState.Success));
  });

  test("should reject invalid transitions", () => {
    assert.ok(!stateManager.transitionTo(IconState.Success)); // disabled -> success invalid
  });

  test("should handle timeout transitions", () => {
    stateManager.transitionTo(IconState.Idle);
    stateManager.transitionTo(IconState.Building);
    stateManager.transitionTo(IconState.Success, 1000);
    
    clock.tick(1000);
    assert.strictEqual(stateManager.getCurrentState(), IconState.Idle);
  });

  test("should clear existing timeouts when setting new state", () => {
    stateManager.transitionTo(IconState.Idle);
    stateManager.transitionTo(IconState.Building);
    stateManager.transitionTo(IconState.Success, 1000);
    stateManager.transitionTo(IconState.Error); // Should clear timeout
    
    clock.tick(1000);
    assert.strictEqual(stateManager.getCurrentState(), IconState.Error);
  });
}); 