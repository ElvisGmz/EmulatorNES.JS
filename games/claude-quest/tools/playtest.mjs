import { readFile, writeFile } from "node:fs/promises";
import { Controller, NES } from "jsnes";
import { encodePng } from "./png.mjs";

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 240;
const SAMPLE_RATE = 44100;
const PLAYER_ONE = 1;

export const Buttons = {
  A: Controller.BUTTON_A,
  B: Controller.BUTTON_B,
  SELECT: Controller.BUTTON_SELECT,
  START: Controller.BUTTON_START,
  UP: Controller.BUTTON_UP,
  DOWN: Controller.BUTTON_DOWN,
  LEFT: Controller.BUTTON_LEFT,
  RIGHT: Controller.BUTTON_RIGHT,
};

/** Runs a ROM (file path or bytes) headlessly in jsnes: scripted input, screenshots, audio levels and RAM peeks. */
export async function createPlaytest(rom) {
  let frameBuffer = new Uint32Array(SCREEN_WIDTH * SCREEN_HEIGHT);
  let audioSamples = [];

  const nes = new NES({
    sampleRate: SAMPLE_RATE,
    onFrame: (buffer) => {
      frameBuffer = Uint32Array.from(buffer);
    },
    onAudioSample: (left) => audioSamples.push(left),
  });
  nes.loadROM(typeof rom === "string" ? new Uint8Array(await readFile(rom)) : rom);

  const session = {
    nes,
    frame(count = 1) {
      for (let index = 0; index < count; index++) nes.frame();
      return session;
    },
    hold(button, frames) {
      nes.buttonDown(PLAYER_ONE, button);
      session.frame(frames);
      nes.buttonUp(PLAYER_ONE, button);
      return session;
    },
    press(button, holdFrames = 4, releaseFrames = 4) {
      return session.hold(button, holdFrames).frame(releaseFrames);
    },
    down(button) {
      nes.buttonDown(PLAYER_ONE, button);
      return session;
    },
    up(button) {
      nes.buttonUp(PLAYER_ONE, button);
      return session;
    },
    peek(address) {
      return nes.cpu.mem[address];
    },
    async screenshot(file, scale = 2) {
      const width = SCREEN_WIDTH * scale;
      const height = SCREEN_HEIGHT * scale;
      const rgb = Buffer.alloc(width * height * 3);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = frameBuffer[Math.floor(y / scale) * SCREEN_WIDTH + Math.floor(x / scale)];
          const offset = (y * width + x) * 3;
          // jsnes pixels are 0xBBGGRR
          rgb[offset] = pixel & 0xff;
          rgb[offset + 1] = (pixel >> 8) & 0xff;
          rgb[offset + 2] = (pixel >> 16) & 0xff;
        }
      }
      await writeFile(file, encodePng(width, height, rgb));
      return session;
    },
    /** Returns the RMS level of the audio produced since the last call. */
    takeAudioLevel() {
      const samples = audioSamples;
      audioSamples = [];
      if (samples.length === 0) return 0;
      const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
      const variance = samples.reduce((sum, value) => sum + (value - mean) ** 2, 0) / samples.length;
      return Math.sqrt(variance);
    },
    takeAudioSamples() {
      const samples = audioSamples;
      audioSamples = [];
      return samples;
    },
    /** Reads a row of background tiles back as text (font tiles are stored at their ASCII codes, "~" draws Ñ). */
    readTextRow(row) {
      const tiles = Array.from(nes.ppu.nameTable[0].tile.slice(row * 32, row * 32 + 32));
      return tiles
        .map((tile) => (tile === 0x7e ? "Ñ" : tile >= 0x20 && tile < 0x60 ? String.fromCharCode(tile) : " "))
        .join("")
        .trim();
    },
    /** Lists visible hardware sprites as { x, y, tile, palette }. */
    sprites() {
      const list = [];
      for (let index = 0; index < 64; index++) {
        const y = nes.ppu.spriteMem[index * 4];
        if (y >= 0xef) continue;
        list.push({
          y: y + 1,
          tile: nes.ppu.spriteMem[index * 4 + 1],
          palette: nes.ppu.spriteMem[index * 4 + 2] & 3,
          x: nes.ppu.spriteMem[index * 4 + 3],
        });
      }
      return list;
    },
    uniqueColors() {
      return new Set(frameBuffer).size;
    },
  };
  return session;
}

/** Reads symbol addresses (e.g. "_score" for a C global) from an ld65 label file (-Ln). */
export async function readSymbols(labelFile) {
  return parseSymbols(await readFile(labelFile, "utf8"));
}

export function parseSymbols(labels) {
  const symbols = {};
  for (const match of labels.matchAll(/^al ([0-9A-F]+) \.(\w+)$/gm)) symbols[match[2]] = parseInt(match[1], 16);
  return symbols;
}
