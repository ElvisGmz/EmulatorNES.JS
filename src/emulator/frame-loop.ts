import { NES_FRAME_RATE } from "./constants";

export const FRAME_DURATION_MS = 1000 / NES_FRAME_RATE;
const MAX_FRAMES_PER_TICK = 4;
// Absorbs vsync jitter so a 60Hz display does not randomly skip a NES frame
const FRAME_TOLERANCE_MS = 1;

export interface FrameScheduler {
  request(callback: (timestamp: number) => void): number;
  cancel(handle: number): void;
}

const animationFrameScheduler: FrameScheduler = {
  request: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

interface FrameLoopOptions {
  onStep: () => void;
  onRender: () => void;
  scheduler?: FrameScheduler;
}

/**
 * Runs the emulation at the NES native rate regardless of the display
 * refresh rate (60Hz, 120Hz, 144Hz...), rendering once per animation frame.
 */
export class FrameLoop {
  private readonly onStep: () => void;
  private readonly onRender: () => void;
  private readonly scheduler: FrameScheduler;
  private handle: number | null = null;
  private lastTimestamp: number | null = null;
  private accumulatedMs = 0;

  constructor({ onStep, onRender, scheduler = animationFrameScheduler }: FrameLoopOptions) {
    this.onStep = onStep;
    this.onRender = onRender;
    this.scheduler = scheduler;
  }

  get isRunning(): boolean {
    return this.handle !== null;
  }

  start(): void {
    if (this.isRunning) return;
    this.lastTimestamp = null;
    this.accumulatedMs = 0;
    this.handle = this.scheduler.request(this.tick);
  }

  stop(): void {
    if (this.handle === null) return;
    this.scheduler.cancel(this.handle);
    this.handle = null;
  }

  private readonly tick = (timestamp: number): void => {
    this.handle = this.scheduler.request(this.tick);

    if (this.lastTimestamp === null) {
      this.lastTimestamp = timestamp;
      return;
    }

    this.accumulatedMs += timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;

    let steps = 0;
    while (this.isRunning && this.accumulatedMs + FRAME_TOLERANCE_MS >= FRAME_DURATION_MS && steps < MAX_FRAMES_PER_TICK) {
      this.onStep();
      this.accumulatedMs -= FRAME_DURATION_MS;
      steps++;
    }

    // Drop the backlog after a long stall (slow device, debugger) instead of fast-forwarding
    if (steps === MAX_FRAMES_PER_TICK) {
      this.accumulatedMs = Math.min(this.accumulatedMs, FRAME_DURATION_MS);
    }

    if (steps > 0 && this.isRunning) this.onRender();
  };
}
