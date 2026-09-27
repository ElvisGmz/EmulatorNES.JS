export const NES_AUDIO_PROCESSOR_NAME = "nes-audio-processor";

// Kept as a string so the worklet can be loaded from a Blob URL without bundler-specific plugins
export const nesAudioProcessorSource = /* js */ `
class NesAudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 8192;
    this.left = new Float32Array(this.capacity);
    this.right = new Float32Array(this.capacity);
    this.readIndex = 0;
    this.writeIndex = 0;
    this.available = 0;

    this.port.onmessage = ({ data }) => {
      const { left, right } = data;
      const overflow = this.available + left.length - this.capacity;
      if (overflow > 0) {
        this.readIndex = (this.readIndex + overflow) % this.capacity;
        this.available -= overflow;
      }
      for (let i = 0; i < left.length; i++) {
        this.left[this.writeIndex] = left[i];
        this.right[this.writeIndex] = right[i];
        this.writeIndex = (this.writeIndex + 1) % this.capacity;
      }
      this.available += left.length;
    };
  }

  process(_inputs, outputs) {
    const [outLeft, outRight] = outputs[0];
    const readable = Math.min(this.available, outLeft.length);

    for (let i = 0; i < readable; i++) {
      outLeft[i] = this.left[this.readIndex];
      outRight[i] = this.right[this.readIndex];
      this.readIndex = (this.readIndex + 1) % this.capacity;
    }
    outLeft.fill(0, readable);
    outRight.fill(0, readable);
    this.available -= readable;

    return true;
  }
}

registerProcessor("${NES_AUDIO_PROCESSOR_NAME}", NesAudioProcessor);
`;
