import { NesButton } from "../emulator/nes-button";
import type { InputHub } from "./input-hub";

const AXIS_THRESHOLD = 0.5;

// Indexes follow the W3C "standard" gamepad layout (Xbox / PlayStation / Switch Pro)
const STANDARD_BUTTON_BINDINGS: ReadonlyArray<readonly [index: number, button: NesButton]> = [
  [0, NesButton.B],
  [1, NesButton.A],
  [2, NesButton.B],
  [3, NesButton.A],
  [8, NesButton.SELECT],
  [9, NesButton.START],
  [12, NesButton.UP],
  [13, NesButton.DOWN],
  [14, NesButton.LEFT],
  [15, NesButton.RIGHT],
];

type GamepadReading = Pick<Gamepad, "axes"> & {
  buttons: ReadonlyArray<Pick<GamepadButton, "pressed">>;
};

export function readGamepadButtons(gamepad: GamepadReading): Set<NesButton> {
  const pressed = new Set<NesButton>();

  for (const [index, button] of STANDARD_BUTTON_BINDINGS) {
    if (gamepad.buttons[index]?.pressed) pressed.add(button);
  }

  const [horizontal = 0, vertical = 0] = gamepad.axes;
  if (horizontal <= -AXIS_THRESHOLD) pressed.add(NesButton.LEFT);
  if (horizontal >= AXIS_THRESHOLD) pressed.add(NesButton.RIGHT);
  if (vertical <= -AXIS_THRESHOLD) pressed.add(NesButton.UP);
  if (vertical >= AXIS_THRESHOLD) pressed.add(NesButton.DOWN);

  return pressed;
}

interface GamepadInputOptions {
  onConnectionChange?: (connectedCount: number) => void;
}

export function bindGamepadInput(hub: InputHub, { onConnectionChange }: GamepadInputOptions = {}): () => void {
  let pollHandle: number | null = null;

  const getConnectedGamepads = () => navigator.getGamepads().filter((gamepad) => gamepad !== null);

  const poll = () => {
    const pressed = new Set<NesButton>();
    for (const gamepad of getConnectedGamepads()) {
      for (const button of readGamepadButtons(gamepad)) pressed.add(button);
    }
    hub.syncSource("gamepad", pressed);
    pollHandle = window.requestAnimationFrame(poll);
  };

  const handleConnectionChange = () => {
    const connectedCount = getConnectedGamepads().length;
    onConnectionChange?.(connectedCount);

    if (connectedCount > 0 && pollHandle === null) {
      pollHandle = window.requestAnimationFrame(poll);
    } else if (connectedCount === 0 && pollHandle !== null) {
      window.cancelAnimationFrame(pollHandle);
      pollHandle = null;
      hub.releaseSource("gamepad");
    }
  };

  window.addEventListener("gamepadconnected", handleConnectionChange);
  window.addEventListener("gamepaddisconnected", handleConnectionChange);

  return () => {
    window.removeEventListener("gamepadconnected", handleConnectionChange);
    window.removeEventListener("gamepaddisconnected", handleConnectionChange);
    if (pollHandle !== null) window.cancelAnimationFrame(pollHandle);
  };
}
