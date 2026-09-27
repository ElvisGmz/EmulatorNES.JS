import { NES_AUDIO_PROCESSOR_NAME, nesAudioProcessorSource } from "./nes-audio-processor";

const FALLBACK_SAMPLE_RATE = 48000;
const BATCH_SIZE = 256;
const VOLUME_RAMP_SECONDS = 0.02;

interface AudioSessionNavigator extends Navigator {
  audioSession?: { type: string };
}

/**
 * Streams emulator samples to an AudioWorklet. Browsers keep the AudioContext
 * suspended until a user gesture, so `resume()` must be called from one.
 */
export class AudioOutput {
  private readonly context: AudioContext | null;
  private readonly volume: GainNode | null;
  private node: AudioWorkletNode | null = null;
  private batchLeft = new Float32Array(BATCH_SIZE);
  private batchRight = new Float32Array(BATCH_SIZE);
  private batchLength = 0;

  constructor() {
    this.context = createAudioContext();
    this.volume = this.context?.createGain() ?? null;
    if (this.context && this.volume) {
      this.volume.connect(this.context.destination);
      void this.connectProcessor(this.context, this.volume);
    }
    playEvenWhenDeviceIsOnSilentMode();
  }

  get sampleRate(): number {
    return this.context?.sampleRate ?? FALLBACK_SAMPLE_RATE;
  }

  readonly writeSample = (left: number, right: number): void => {
    if (!this.node) return;

    this.batchLeft[this.batchLength] = left;
    this.batchRight[this.batchLength] = right;
    this.batchLength++;

    if (this.batchLength === BATCH_SIZE) this.flush();
  };

  flush(): void {
    if (!this.node || this.batchLength === 0) return;

    const left = this.batchLeft.slice(0, this.batchLength);
    const right = this.batchRight.slice(0, this.batchLength);
    this.node.port.postMessage({ left, right }, [left.buffer, right.buffer]);
    this.batchLength = 0;
  }

  async resume(): Promise<void> {
    if (!this.context || this.context.state === "running") return;
    try {
      await this.context.resume();
    } catch {
      // Resuming outside a user gesture is rejected; the next gesture retries
    }
  }

  suspend(): void {
    if (this.context?.state === "running") void this.context.suspend();
  }

  setMuted(muted: boolean): void {
    if (!this.context || !this.volume) return;
    this.volume.gain.setTargetAtTime(muted ? 0 : 1, this.context.currentTime, VOLUME_RAMP_SECONDS);
  }

  private async connectProcessor(context: AudioContext, destination: AudioNode): Promise<void> {
    if (!context.audioWorklet) {
      console.warn("AudioWorklet requires a secure context (https or localhost). Sound is disabled.");
      return;
    }

    const moduleUrl = URL.createObjectURL(
      new Blob([nesAudioProcessorSource], { type: "application/javascript" }),
    );
    try {
      await context.audioWorklet.addModule(moduleUrl);
      this.node = new AudioWorkletNode(context, NES_AUDIO_PROCESSOR_NAME, {
        numberOfInputs: 0,
        outputChannelCount: [2],
      });
      this.node.connect(destination);
    } catch (error) {
      console.warn("Could not start the audio processor. Sound is disabled.", error);
    } finally {
      URL.revokeObjectURL(moduleUrl);
    }
  }
}

function createAudioContext(): AudioContext | null {
  try {
    return new AudioContext({ latencyHint: "interactive" });
  } catch {
    return null;
  }
}

function playEvenWhenDeviceIsOnSilentMode(): void {
  const { audioSession } = navigator as AudioSessionNavigator;
  if (audioSession) audioSession.type = "playback";
}
