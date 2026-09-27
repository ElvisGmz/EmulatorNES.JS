import { NesButton } from "../emulator/nes-button";
import type { InputHub } from "./input-hub";

export const DEFAULT_KEY_BINDINGS: Readonly<Record<string, NesButton>> = {
  ArrowUp: NesButton.UP,
  ArrowDown: NesButton.DOWN,
  ArrowLeft: NesButton.LEFT,
  ArrowRight: NesButton.RIGHT,
  KeyX: NesButton.A,
  KeyA: NesButton.A,
  KeyK: NesButton.A,
  KeyZ: NesButton.B,
  KeyS: NesButton.B,
  KeyJ: NesButton.B,
  Enter: NesButton.START,
  ShiftLeft: NesButton.SELECT,
  ShiftRight: NesButton.SELECT,
};

export function resolveKeyButton(
  code: string,
  bindings: Readonly<Record<string, NesButton>> = DEFAULT_KEY_BINDINGS,
): NesButton | undefined {
  return Object.hasOwn(bindings, code) ? bindings[code] : undefined;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

interface KeyboardInputOptions {
  isEnabled: () => boolean;
}

export function bindKeyboardInput(hub: InputHub, { isEnabled }: KeyboardInputOptions): () => void {
  const handleKey = (event: KeyboardEvent, pressed: boolean) => {
    if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;

    const button = resolveKeyButton(event.code);
    if (button === undefined || !isEnabled()) return;

    event.preventDefault();
    if (!event.repeat) hub.setButton("keyboard", button, pressed);
  };

  const handleKeyDown = (event: KeyboardEvent) => handleKey(event, true);
  const handleKeyUp = (event: KeyboardEvent) => handleKey(event, false);
  const releaseKeys = () => hub.releaseSource("keyboard");

  document.addEventListener("keydown", handleKeyDown);
  document.addEventListener("keyup", handleKeyUp);
  window.addEventListener("blur", releaseKeys);

  return () => {
    document.removeEventListener("keydown", handleKeyDown);
    document.removeEventListener("keyup", handleKeyUp);
    window.removeEventListener("blur", releaseKeys);
  };
}
