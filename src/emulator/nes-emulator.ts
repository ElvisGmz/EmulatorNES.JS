import { NES, type EmulatorData } from "jsnes";
import { AudioOutput } from "./audio/audio-output";
import { FrameLoop } from "./frame-loop";
import type { NesButton } from "./nes-button";
import { VideoRenderer } from "./video-renderer";

const PLAYER_ONE = 1;

export type EmulatorStatus = "idle" | "running" | "paused" | "crashed";
export type EmulatorSnapshot = EmulatorData;

interface NesEmulatorOptions {
  canvas: HTMLCanvasElement;
  onStatusChange?: (status: EmulatorStatus) => void;
  onCrash?: (error: unknown) => void;
}

export class NesEmulator {
  private readonly video: VideoRenderer;
  private readonly loop: FrameLoop;
  private readonly onStatusChange: (status: EmulatorStatus) => void;
  private readonly onCrash: (error: unknown) => void;
  private audio: AudioOutput | null = null;
  private nes: NES | null = null;
  private currentStatus: EmulatorStatus = "idle";

  constructor({ canvas, onStatusChange = () => {}, onCrash = () => {} }: NesEmulatorOptions) {
    this.video = new VideoRenderer(canvas);
    this.onStatusChange = onStatusChange;
    this.onCrash = onCrash;
    this.loop = new FrameLoop({ onStep: this.step, onRender: this.video.present });
  }

  get status(): EmulatorStatus {
    return this.currentStatus;
  }

  get hasGame(): boolean {
    return this.nes !== null;
  }

  /** Call synchronously inside a user gesture (click, tap, key) so browsers allow audio playback. */
  prepareAudio(): void {
    void this.ensureAudio().resume();
  }

  loadRom(romData: Uint8Array): void {
    const audio = this.ensureAudio();
    const nes = new NES({
      onFrame: this.video.writeFrame,
      onAudioSample: audio.writeSample,
      sampleRate: audio.sampleRate,
    });
    nes.loadROM(romData);

    this.loop.stop();
    this.nes = nes;
    this.video.clear();
    this.run();
  }

  pause(): void {
    if (this.currentStatus !== "running") return;
    this.loop.stop();
    this.audio?.suspend();
    this.setStatus("paused");
  }

  resume(): void {
    if (this.currentStatus !== "paused") return;
    this.run();
  }

  togglePause(): void {
    if (this.currentStatus === "running") this.pause();
    else this.resume();
  }

  reset(): void {
    if (!this.nes) return;
    this.nes.reloadROM();
    this.run();
  }

  unlockAudio(): void {
    if (this.currentStatus === "running") void this.audio?.resume();
  }

  setMuted(muted: boolean): void {
    this.audio?.setMuted(muted);
  }

  pressButton(button: NesButton): void {
    this.nes?.buttonDown(PLAYER_ONE, button);
  }

  releaseButton(button: NesButton): void {
    this.nes?.buttonUp(PLAYER_ONE, button);
  }

  createSnapshot(): EmulatorSnapshot | null {
    return this.nes?.toJSON() ?? null;
  }

  restoreSnapshot(snapshot: EmulatorSnapshot): void {
    if (!this.nes) return;
    this.nes.fromJSON(snapshot);
    this.run();
  }

  private run(): void {
    this.loop.start();
    void this.audio?.resume();
    this.setStatus("running");
  }

  private readonly step = (): void => {
    try {
      this.nes?.frame();
      this.audio?.flush();
    } catch (error) {
      this.loop.stop();
      this.audio?.suspend();
      this.setStatus("crashed");
      this.onCrash(error);
    }
  };

  private ensureAudio(): AudioOutput {
    this.audio ??= new AudioOutput();
    return this.audio;
  }

  private setStatus(status: EmulatorStatus): void {
    if (this.currentStatus === status) return;
    this.currentStatus = status;
    this.onStatusChange(status);
  }
}
