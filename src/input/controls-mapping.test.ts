import { describe, expect, it } from "vitest";
import { NesButton } from "../emulator/nes-button";
import { readGamepadButtons } from "./gamepad-input";
import { resolveKeyButton } from "./keyboard-input";
import { resolveActionButtons, resolveDpadButtons, type ActionButtonArea } from "./touch-input";

describe("resolveKeyButton", () => {
  it.each([
    ["ArrowUp", NesButton.UP],
    ["KeyX", NesButton.A],
    ["KeyA", NesButton.A],
    ["KeyZ", NesButton.B],
    ["KeyS", NesButton.B],
    ["Enter", NesButton.START],
    ["ShiftRight", NesButton.SELECT],
  ])("maps %s", (code, button) => {
    expect(resolveKeyButton(code)).toBe(button);
  });

  it("ignores unmapped and prototype keys", () => {
    expect(resolveKeyButton("KeyQ")).toBeUndefined();
    expect(resolveKeyButton("toString")).toBeUndefined();
  });
});

describe("resolveDpadButtons", () => {
  const radius = 100;

  it("ignores touches inside the dead zone", () => {
    expect(resolveDpadButtons(5, -5, radius)).toEqual([]);
  });

  it("resolves cardinal directions with some angular tolerance", () => {
    expect(resolveDpadButtons(80, 0, radius)).toEqual([NesButton.RIGHT]);
    expect(resolveDpadButtons(80, 30, radius)).toEqual([NesButton.RIGHT]);
    expect(resolveDpadButtons(0, -80, radius)).toEqual([NesButton.UP]);
  });

  it("resolves diagonals near 45 degrees", () => {
    expect(resolveDpadButtons(-60, 60, radius)).toEqual([NesButton.LEFT, NesButton.DOWN]);
    expect(resolveDpadButtons(60, -60, radius)).toEqual([NesButton.RIGHT, NesButton.UP]);
  });
});

describe("readGamepadButtons", () => {
  const createGamepad = (pressedIndexes: number[], axes: number[] = [0, 0]) => ({
    axes,
    buttons: Array.from({ length: 17 }, (_, index) => ({ pressed: pressedIndexes.includes(index) })),
  });

  it("maps the standard layout to NES buttons", () => {
    expect(readGamepadButtons(createGamepad([0, 9]))).toEqual(new Set([NesButton.B, NesButton.START]));
    expect(readGamepadButtons(createGamepad([1, 12]))).toEqual(new Set([NesButton.A, NesButton.UP]));
  });

  it("reads the left stick as a D-pad", () => {
    expect(readGamepadButtons(createGamepad([], [-0.9, 0.7]))).toEqual(new Set([NesButton.LEFT, NesButton.DOWN]));
    expect(readGamepadButtons(createGamepad([], [0.2, -0.3]))).toEqual(new Set());
  });
});

describe("resolveActionButtons", () => {
  // B lower-left and A upper-right, almost touching, like the on-screen layout
  const areas: ActionButtonArea[] = [
    { button: NesButton.B, centerX: 40, centerY: 70, radius: 40 },
    { button: NesButton.A, centerX: 122, centerY: 40, radius: 40 },
  ];
  const seam = { x: (40 + 122) / 2, y: (70 + 40) / 2 };

  it("presses the button under the thumb", () => {
    expect(resolveActionButtons(40, 70, areas)).toEqual([NesButton.B]);
    expect(resolveActionButtons(125, 35, areas)).toEqual([NesButton.A]);
  });

  it("presses A and B together when the thumb rests on the seam", () => {
    expect(new Set(resolveActionButtons(seam.x, seam.y, areas))).toEqual(new Set([NesButton.A, NesButton.B]));
  });

  it("switches from B to both to A while sliding across", () => {
    const path = [0, 0.3, 0.5, 0.7, 1].map((progress) =>
      resolveActionButtons(40 + (122 - 40) * progress, 70 + (40 - 70) * progress, areas).length,
    );
    expect(path).toEqual([1, 1, 2, 1, 1]);
  });

  it("ignores touches far away from both buttons", () => {
    expect(resolveActionButtons(300, 300, areas)).toEqual([]);
  });
});
