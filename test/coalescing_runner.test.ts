import * as assert from "assert";
import * as sinon from "sinon";
import { CoalescingRunner } from "../src/extension/coalescing_runner";

describe("CoalescingRunner", () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it("runs the task once, 500ms after a burst of schedules", async () => {
    let runs = 0;
    const runner = new CoalescingRunner(500, async () => {
      runs++;
    });

    for (let i = 0; i < 1000; i++) {
      runner.schedule();
      await clock.tickAsync(10);
    }
    assert.strictEqual(runs, 0);

    // 10ms of the delay have already passed since the last schedule().
    await clock.tickAsync(489);
    assert.strictEqual(runs, 0);
    await clock.tickAsync(1);
    assert.strictEqual(runs, 1);

    runner.dispose();
  });

  it("folds schedules during a run into one trailing run", async () => {
    let running = 0;
    let maxRunning = 0;
    let runs = 0;
    const runner = new CoalescingRunner(500, async () => {
      runs++;
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
      running--;
    });

    runner.schedule();
    await clock.tickAsync(500);
    assert.strictEqual(runs, 1);

    // Many bursts while the first run is still in flight.
    for (let i = 0; i < 50; i++) {
      runner.schedule();
      await clock.tickAsync(100);
    }
    assert.strictEqual(runs, 1);

    // The first run finishes; exactly one trailing run follows.
    await clock.tickAsync(100_000);
    assert.strictEqual(runs, 2);
    assert.strictEqual(maxRunning, 1);

    runner.dispose();
  });

  it("aborts the run in flight and drops pending runs on dispose", async () => {
    const signals: AbortSignal[] = [];
    const runner = new CoalescingRunner(500, async (signal) => {
      signals.push(signal);
      await new Promise((resolve) => setTimeout(resolve, 10_000));
    });

    runner.schedule();
    await clock.tickAsync(500);
    runner.schedule();
    runner.dispose();
    runner.schedule();

    assert.strictEqual(signals.length, 1);
    assert.strictEqual(signals[0].aborted, true);
    await clock.tickAsync(100_000);
    assert.strictEqual(signals.length, 1);
  });

  it("keeps running after a task throws", async () => {
    let runs = 0;
    const runner = new CoalescingRunner(500, () => {
      runs++;
      throw new Error("query failed");
    });

    runner.schedule();
    await clock.tickAsync(500);
    runner.schedule();
    await clock.tickAsync(500);
    assert.strictEqual(runs, 2);

    runner.dispose();
  });
});
