// Compiles the song notation in music/songs.mjs into the byte streams read by src/audio.c.
//
// Stream bytes:
//   0x00-0x6B  play note (0 = C1) for the current duration
//   0x6C       rest for the current duration
//   0x70-0x7F  switch instrument (low nibble)
//   0x80-0xFD  set duration in frames (value & 0x7F)
//   0xFE       jump back to the start of the stream (loop)
//   0xFF       end of stream

const NOTE_NAMES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LOWEST_OCTAVE = 1;
export const NOTE_COUNT = 108;
const CPU_CLOCK_HZ = 1789773;

const REST = 0x6c;
const INSTRUMENT = 0x70;
const DURATION = 0x80;
const MAX_DURATION = 0x7d;
const LOOP = 0xfe;
const END = 0xff;

export const CHANNELS = ["pulse1", "pulse2", "triangle", "noise"];

export function noteNumber(name) {
  const match = /^([A-G])(#|b)?(\d)$/.exec(name);
  if (!match) throw new Error(`Invalid note "${name}"`);
  const [, letter, accidental, octave] = match;
  const semitone = NOTE_NAMES[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  const number = (Number(octave) - LOWEST_OCTAVE) * 12 + semitone;
  if (number < 0 || number >= NOTE_COUNT) throw new Error(`Note "${name}" is out of range`);
  return number;
}

function noteFrequency(number) {
  const midi = number + 24;
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Pulse channel timer periods; the triangle plays an octave lower, so it reads the entry 12 notes above. */
export function buildPeriodTable() {
  return Array.from({ length: NOTE_COUNT + 12 }, (_, number) =>
    Math.min(0x7ff, Math.round(CPU_CLOCK_HZ / (16 * noteFrequency(number)) - 1)),
  );
}

/**
 * Parses "E5/8 G5/8. r/4 K/8 C5:3" into bytes. "/n" is a note value (4 = quarter, a
 * trailing "." dots it) measured with `framesPerSixteenth`; ":n" is an exact frame count.
 * Drum names map to instrument + noise period through `drums`.
 */
export function compileStream(notation, { framesPerSixteenth = 6, instrument, drums = {}, loop = false }) {
  const bytes = [];
  let currentDuration = null;
  let currentInstrument = null;

  const setInstrument = (index) => {
    if (index === currentInstrument) return;
    bytes.push(INSTRUMENT | index);
    currentInstrument = index;
  };
  const setDuration = (frames) => {
    if (frames === currentDuration) return;
    if (frames < 1 || frames > MAX_DURATION) throw new Error(`Duration of ${frames} frames is out of range`);
    bytes.push(DURATION | frames);
    currentDuration = frames;
  };

  if (instrument !== undefined) setInstrument(instrument);

  for (const token of notation.trim().split(/\s+/)) {
    const match = /^([^/:]+)(?:\/(\d+)(\.?)|:(\d+))$/.exec(token);
    if (!match) throw new Error(`Invalid token "${token}"`);
    const [, pitch, noteValue, dotted, exactFrames] = match;

    const sixteenths = noteValue ? (16 / Number(noteValue)) * (dotted ? 1.5 : 1) : null;
    const frames = exactFrames ? Number(exactFrames) : sixteenths * framesPerSixteenth;
    if (!Number.isInteger(frames)) throw new Error(`"${token}" does not land on a whole frame`);
    setDuration(frames);

    if (pitch === "r") bytes.push(REST);
    else if (drums[pitch]) {
      setInstrument(drums[pitch].instrument);
      bytes.push(drums[pitch].period);
    } else bytes.push(noteNumber(pitch));
  }

  bytes.push(loop ? LOOP : END);
  return bytes;
}

/** Total frames of a stream, used to check that every channel of a song lines up. */
export function streamLength(bytes) {
  let duration = 0;
  let total = 0;
  for (const byte of bytes) {
    if (byte >= DURATION && byte <= DURATION + MAX_DURATION) duration = byte & 0x7f;
    else if (byte <= REST) total += duration;
  }
  return total;
}
