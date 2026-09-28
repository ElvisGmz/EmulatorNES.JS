// Original music and sound effects for Claude Quest.
// Notes: "C5/8" = C in octave 5 for an eighth, "G5/4." = dotted quarter, "r/4" = rest,
// "C6:3" = exactly 3 frames. Drums: K = kick, S = snare, H = hi-hat.

// Pulse duty: 0 = 12.5%, 1 = 25%, 2 = 50%, 3 = 75%
export const INSTRUMENTS = {
  lead: { index: 0, duty: 2, volume: 9, decayFrames: 5, sustain: 5 },
  harmony: { index: 1, duty: 1, volume: 4, decayFrames: 8, sustain: 2 },
  bass: { index: 2, duty: 0, volume: 15, decayFrames: 0, sustain: 15 },
  kick: { index: 3, duty: 0, volume: 11, decayFrames: 1, sustain: 0 },
  snare: { index: 4, duty: 0, volume: 8, decayFrames: 1, sustain: 0 },
  hat: { index: 5, duty: 0, volume: 3, decayFrames: 1, sustain: 0 },
  blip: { index: 6, duty: 2, volume: 11, decayFrames: 2, sustain: 3 },
  chime: { index: 7, duty: 1, volume: 12, decayFrames: 3, sustain: 0 },
  sad: { index: 8, duty: 0, volume: 9, decayFrames: 8, sustain: 4 },
  thud: { index: 9, duty: 0, volume: 13, decayFrames: 1, sustain: 0 },
};

export const DRUMS = {
  K: { instrument: INSTRUMENTS.kick.index, period: 12 },
  S: { instrument: INSTRUMENTS.snare.index, period: 6 },
  H: { instrument: INSTRUMENTS.hat.index, period: 1 },
};

const bars = (...lines) => lines.join(" ");
const repeat = (text, times) => Array(times).fill(text).join(" ");

// Seven bars of a steady beat plus a snare fill leading back to the top
const TITLE_BEAT = bars(repeat("K/8 H/8 S/8 H/8", 14), "K/8 H/8 S/8 H/8 K/8 S/16 S/16 S/8 S/8");

export const SONGS = {
  title: {
    framesPerSixteenth: 7,
    loop: true,
    pulse1: {
      instrument: "lead",
      notes: bars(
        "E5/8 G5/8 C6/8 G5/8 E6/4 D6/8 C6/8",
        "A5/8 C6/8 E6/8 C6/8 D6/4 C6/8 B5/8",
        "C6/8 A5/8 F5/8 A5/8 C6/4 D6/8 E6/8",
        "D6/4. B5/8 G5/2",
        "E5/8 G5/8 C6/8 G5/8 E6/4 G6/8 E6/8",
        "F6/8 E6/8 D6/8 C6/8 A5/4 C6/4",
        "D6/8 C6/8 A5/8 C6/8 B5/4 D6/4",
        "C6/2 r/4 G5/4",
      ),
    },
    pulse2: {
      instrument: "harmony",
      notes: bars(
        repeat("C4/8 E4/8 G4/8 E4/8", 2),
        repeat("A3/8 C4/8 E4/8 C4/8", 2),
        repeat("F3/8 A3/8 C4/8 A3/8", 2),
        repeat("G3/8 B3/8 D4/8 B3/8", 2),
        repeat("C4/8 E4/8 G4/8 E4/8", 2),
        repeat("A3/8 C4/8 E4/8 C4/8", 2),
        "F3/8 A3/8 C4/8 A3/8 G3/8 B3/8 D4/8 B3/8",
        "C4/8 E4/8 G4/8 E4/8 C4/2",
      ),
    },
    triangle: {
      instrument: "bass",
      notes: bars(
        "C3/4 C3/8 C3/8 G2/4 C3/4",
        "A2/4 A2/8 A2/8 E2/4 A2/4",
        "F2/4 F2/8 F2/8 C3/4 F2/4",
        "G2/4 G2/8 G2/8 D3/4 G2/4",
        "C3/4 C3/8 C3/8 G2/4 C3/4",
        "A2/4 A2/8 A2/8 E2/4 A2/4",
        "F2/4 F2/4 G2/4 G2/4",
        "C3/4 G2/4 C3/2",
      ),
    },
    noise: { notes: TITLE_BEAT },
  },

  level: {
    framesPerSixteenth: 6,
    loop: true,
    pulse1: {
      instrument: "lead",
      notes: bars(
        "B4/8 D5/8 G5/8 D5/8 B5/8 A5/8 G5/8 D5/8",
        "E5/8 G5/8 B5/8 G5/8 A5/4 G5/8 E5/8",
        "C5/8 E5/8 G5/8 E5/8 A5/8 G5/8 E5/8 C5/8",
        "D5/4 F#5/8 A5/8 D6/4 C6/4",
        "B5/8 A5/8 G5/8 D5/8 B4/8 D5/8 G5/4",
        "B5/8 C6/8 B5/8 A5/8 G5/8 E5/8 G5/4",
        "E5/8 G5/8 C6/8 B5/8 A5/8 G5/8 A5/4",
        "F#5/8 G5/8 A5/8 B5/8 A5/2",
        "E6/4 D6/8 C6/8 G5/4 E5/4",
        "F#5/4 A5/8 D6/8 C6/4 A5/4",
        "B5/4 A5/8 G5/8 F#5/4 D5/4",
        "E5/8 F#5/8 G5/8 A5/8 B5/2",
        "C6/8 B5/8 A5/8 G5/8 E5/4 G5/4",
        "A5/8 G5/8 F#5/8 E5/8 D5/4 F#5/4",
        "G5/8 B5/8 D6/8 B5/8 G6/4 D6/4",
        "G5/4 r/4 D5/8 E5/8 F#5/8 A5/8",
      ),
    },
    pulse2: {
      instrument: "harmony",
      notes: bars(
        repeat("G3/8 B3/8 D4/8 B3/8", 2),
        repeat("E3/8 G3/8 B3/8 G3/8", 2),
        repeat("C3/8 E3/8 G3/8 E3/8", 2),
        repeat("D3/8 F#3/8 A3/8 F#3/8", 2),
        repeat("G3/8 B3/8 D4/8 B3/8", 2),
        repeat("E3/8 G3/8 B3/8 G3/8", 2),
        repeat("C3/8 E3/8 G3/8 E3/8", 2),
        repeat("D3/8 F#3/8 A3/8 F#3/8", 2),
        repeat("C3/8 E3/8 G3/8 E3/8", 2),
        repeat("D3/8 F#3/8 A3/8 F#3/8", 2),
        repeat("B2/8 D3/8 F#3/8 D3/8", 2),
        repeat("E3/8 G3/8 B3/8 G3/8", 2),
        repeat("C3/8 E3/8 G3/8 E3/8", 2),
        repeat("D3/8 F#3/8 A3/8 F#3/8", 2),
        repeat("G3/8 B3/8 D4/8 B3/8", 2),
        "G3/8 B3/8 D4/8 B3/8 D3/8 F#3/8 A3/8 F#3/8",
      ),
    },
    triangle: {
      instrument: "bass",
      notes: bars(
        "G2/8 G2/8 D3/8 G2/8 B2/8 G2/8 D3/8 B2/8",
        "E2/8 E2/8 B2/8 E2/8 G2/8 E2/8 B2/8 G2/8",
        "C3/8 C3/8 G2/8 C3/8 E3/8 C3/8 G2/8 E2/8",
        "D3/8 D3/8 A2/8 D3/8 F#3/8 D3/8 A2/8 F#2/8",
        "G2/8 G2/8 D3/8 G2/8 B2/8 G2/8 D3/8 B2/8",
        "E2/8 E2/8 B2/8 E2/8 G2/8 E2/8 B2/8 G2/8",
        "C3/8 C3/8 G2/8 C3/8 E3/8 C3/8 G2/8 E2/8",
        "D3/8 D3/8 A2/8 D3/8 F#3/8 D3/8 A2/8 F#2/8",
        "C3/8 C3/8 G2/8 C3/8 E3/8 C3/8 G2/8 E2/8",
        "D3/8 D3/8 A2/8 D3/8 F#3/8 D3/8 A2/8 F#2/8",
        "B2/8 B2/8 F#2/8 B2/8 D3/8 B2/8 F#2/8 D3/8",
        "E2/8 E2/8 B2/8 E2/8 G2/8 E2/8 B2/8 G2/8",
        "C3/8 C3/8 G2/8 C3/8 E3/8 C3/8 G2/8 E2/8",
        "D3/8 D3/8 A2/8 D3/8 F#3/8 D3/8 A2/8 F#2/8",
        "G2/8 G2/8 D3/8 G2/8 B2/8 G2/8 D3/8 B2/8",
        "G2/8 G2/8 D3/8 G2/8 D2/8 E2/8 F#2/8 A2/8",
      ),
    },
    noise: { notes: repeat("K/8 H/8 S/8 H/8 K/8 K/8 S/8 H/8", 16) },
  },

  clear: {
    framesPerSixteenth: 5,
    loop: false,
    pulse1: { instrument: "lead", notes: "G5/16 C6/16 E6/16 G6/8 E6/16 G6/2" },
    pulse2: { instrument: "harmony", notes: "E5/16 G5/16 C6/16 E6/8 C6/16 E6/2" },
    triangle: { instrument: "bass", notes: "C3/16 E3/16 G3/16 C4/8 G3/16 C4/2" },
    noise: { notes: "S/16 S/16 S/16 K/8 S/16 K/2" },
  },

  gameOver: {
    framesPerSixteenth: 8,
    loop: false,
    pulse1: { instrument: "sad", notes: "G5/8 F#5/8 F5/8 E5/2 r/8 C5/2" },
    triangle: { instrument: "bass", notes: "C3/2 G2/4 r/8 C2/2" },
  },

  win: {
    framesPerSixteenth: 6,
    loop: false,
    pulse1: {
      instrument: "lead",
      notes: "G5/8 C6/8 E6/8 G6/4 E6/8 F6/4 D6/8 E6/2 C6/8 E6/8 G6/8 C7/2",
    },
    pulse2: {
      instrument: "harmony",
      notes: "E5/8 G5/8 C6/8 E6/4 C6/8 D6/4 B5/8 C6/2 G5/8 C6/8 E6/8 G6/2",
    },
    triangle: {
      instrument: "bass",
      notes: "C3/4 C3/8 C3/8 A2/4 A2/8 G2/4 G2/8 C3/2 C3/4 G2/4 C3/2",
    },
    noise: { notes: "K/8 H/8 S/8 H/8 K/8 H/8 S/8 H/8 K/8 H/8 S/8 H/8 K/8 H/8 S/8 H/8 K/4 S/4 K/2" },
  },
};

// Sound effects play on pulse 2 or noise for a moment, then give the channel back to the music
export const SOUND_EFFECTS = {
  jump: { channel: "pulse2", instrument: "blip", notes: "C5:2 E5:2 G5:2 C6:3" },
  token: { channel: "pulse2", instrument: "chime", notes: "B5:4 E6:10" },
  stomp: { channel: "noise", notes: "K:3 S:6" },
  hurt: { channel: "pulse2", instrument: "blip", notes: "G5:4 F5:4 D5:4 B4:4 G4:8" },
  start: { channel: "pulse2", instrument: "chime", notes: "C6:4 G6:12" },
  life: { channel: "pulse2", instrument: "chime", notes: "C6:4 E6:4 G6:4 C7:12" },
};
