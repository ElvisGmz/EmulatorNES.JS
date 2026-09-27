import { describe, expect, it, vi } from "vitest";
import { FRAME_DURATION_MS, FrameLoop, type FrameScheduler } from "./frame-loop";

function createManualScheduler() {
  let pending: ((timestamp: number) => void) | null = null;
  const scheduler: FrameScheduler = {
    request: (callback) => {
      pending = callback;
      return 1;
    },
    cancel: () => {
      pending = null;
    },
  };
  const advanceTo = (timestamp: number) => {
    const callback = pending;
    pending = null;
    callback?.(timestamp);
  };
  return { scheduler, advanceTo };
}

function createLoop() {
  const onStep = vi.fn();
  const onRender = vi.fn();
  const { scheduler, advanceTo } = createManualScheduler();
  const loop = new FrameLoop({ onStep, onRender, scheduler });
  return { loop, onStep, onRender, advanceTo };
}

describe("FrameLoop", () => {
  it("runs one emulation step per NES frame on a 60Hz display", () => {
    const { loop, onStep, onRender, advanceTo } = createLoop();
    loop.start();

    advanceTo(0);
    for (let frame = 1; frame <= 60; frame++) advanceTo(frame * FRAME_DURATION_MS);

    expect(onStep).toHaveBeenCalledTimes(60);
    expect(onRender).toHaveBeenCalledTimes(60);
  });

  it("keeps the NES speed on a 120Hz display", () => {
    const { loop, onStep, onRender, advanceTo } = createLoop();
    loop.start();

    advanceTo(0);
    for (let tick = 1; tick <= 120; tick++) advanceTo(tick * (FRAME_DURATION_MS / 2));

    expect(onStep).toHaveBeenCalledTimes(60);
    expect(onRender).toHaveBeenCalledTimes(60);
  });

  it("drops the backlog after a long stall instead of fast-forwarding", () => {
    const { loop, onStep, advanceTo } = createLoop();
    loop.start();

    advanceTo(0);
    advanceTo(5000);
    advanceTo(5000 + FRAME_DURATION_MS);

    expect(onStep.mock.calls.length).toBeLessThanOrEqual(6);
  });

  it("stops stepping when stopped from inside a step", () => {
    const { loop, onStep, onRender, advanceTo } = createLoop();
    onStep.mockImplementation(() => loop.stop());
    loop.start();

    advanceTo(0);
    advanceTo(FRAME_DURATION_MS * 3);

    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onRender).not.toHaveBeenCalled();
    expect(loop.isRunning).toBe(false);
  });
});
