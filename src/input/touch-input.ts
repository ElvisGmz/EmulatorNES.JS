import { getNesButtonName, NesButton, parseNesButtonName } from "../emulator/nes-button";
import type { InputHub } from "./input-hub";

const DPAD_DEADZONE_RATIO = 0.2;
// Diagonals only trigger within ±15° of 45°, so cardinal directions are easier to hold
const DPAD_AXIS_ACTIVATION = Math.sin(Math.PI / 6);
const HAPTIC_PULSE_MS = 8;

export function resolveDpadButtons(offsetX: number, offsetY: number, radius: number): NesButton[] {
  const distance = Math.hypot(offsetX, offsetY);
  if (distance < radius * DPAD_DEADZONE_RATIO) return [];

  const buttons: NesButton[] = [];
  const minimumAxisOffset = distance * DPAD_AXIS_ACTIVATION;

  if (offsetX <= -minimumAxisOffset) buttons.push(NesButton.LEFT);
  if (offsetX >= minimumAxisOffset) buttons.push(NesButton.RIGHT);
  if (offsetY <= -minimumAxisOffset) buttons.push(NesButton.UP);
  if (offsetY >= minimumAxisOffset) buttons.push(NesButton.DOWN);

  return buttons;
}

type PointerTarget = "dpad" | "buttons";

interface TrackedPointer {
  target: PointerTarget;
  buttons: NesButton[];
}

/**
 * Handles every on-screen control inside `root`. Moves are tracked on window,
 * so fingers can slide across the D-pad or between A and B without lifting.
 */
export function bindTouchInput(root: HTMLElement, hub: InputHub): () => void {
  const dpad = root.querySelector<HTMLElement>("[data-dpad]");
  const pointers = new Map<number, TrackedPointer>();
  let pressedButtons = new Set<NesButton>();

  const resolvePointerButtons = (pointer: TrackedPointer, event: PointerEvent): NesButton[] => {
    if (pointer.target === "dpad" && dpad) {
      const bounds = dpad.getBoundingClientRect();
      return resolveDpadButtons(
        event.clientX - (bounds.left + bounds.width / 2),
        event.clientY - (bounds.top + bounds.height / 2),
        bounds.width / 2,
      );
    }

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const button = parseNesButtonName(element?.closest<HTMLElement>("[data-nes-button]")?.dataset.nesButton);
    return button === undefined ? [] : [button];
  };

  const syncPressedButtons = () => {
    const nextButtons = new Set([...pointers.values()].flatMap((pointer) => pointer.buttons));
    const hasNewPress = [...nextButtons].some((button) => !pressedButtons.has(button));

    pressedButtons = nextButtons;
    hub.syncSource("touch", nextButtons);
    renderPressedState(root, nextButtons);

    if (hasNewPress) navigator.vibrate?.(HAPTIC_PULSE_MS);
  };

  const handlePointerDown = (event: PointerEvent) => {
    const element = event.target instanceof Element ? event.target : null;
    const isOnDpad = Boolean(dpad && element && dpad.contains(element));
    const isOnButton = Boolean(element?.closest("[data-nes-button]"));
    if (!isOnDpad && !isOnButton) return;

    event.preventDefault();

    const pointer: TrackedPointer = { target: isOnDpad ? "dpad" : "buttons", buttons: [] };
    pointer.buttons = resolvePointerButtons(pointer, event);
    pointers.set(event.pointerId, pointer);
    syncPressedButtons();
  };

  const handlePointerMove = (event: PointerEvent) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;

    const nextButtons = resolvePointerButtons(pointer, event);
    if (nextButtons.join() === pointer.buttons.join()) return;

    pointer.buttons = nextButtons;
    syncPressedButtons();
  };

  const handlePointerEnd = (event: PointerEvent) => {
    if (!pointers.delete(event.pointerId)) return;
    syncPressedButtons();
  };

  const preventContextMenu = (event: Event) => event.preventDefault();

  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("contextmenu", preventContextMenu);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  return () => {
    root.removeEventListener("pointerdown", handlePointerDown);
    root.removeEventListener("contextmenu", preventContextMenu);
    window.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("pointerup", handlePointerEnd);
    window.removeEventListener("pointercancel", handlePointerEnd);
    pointers.clear();
    hub.releaseSource("touch");
  };
}

function renderPressedState(root: HTMLElement, pressedButtons: ReadonlySet<NesButton>): void {
  const pressedNames = new Set<string>([...pressedButtons].map(getNesButtonName));
  for (const element of root.querySelectorAll<HTMLElement>("[data-nes-button]")) {
    element.toggleAttribute("data-pressed", pressedNames.has(element.dataset.nesButton ?? ""));
  }
}
