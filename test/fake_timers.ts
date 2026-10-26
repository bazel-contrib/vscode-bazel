import * as sinon from "sinon";

/**
 * Installs sinon fake timers in a way that is safe inside VS Code's
 * extension host, which is shared with VS Code's built-in extensions:
 * their pending native timers stay clearable, and only `setTimeout` and
 * `clearTimeout` (what `CoalescingRunner` uses) are faked, so their other
 * timer functions keep working.
 */
export function useFakeTimers(
  sandbox: sinon.SinonSandbox | typeof sinon = sinon,
): sinon.SinonFakeTimers {
  return sandbox.useFakeTimers({
    shouldClearNativeTimers: true,
    toFake: ["setTimeout", "clearTimeout"],
  });
}
