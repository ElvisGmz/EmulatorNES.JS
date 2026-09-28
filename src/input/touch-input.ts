import { getNesButtonName, NesButton, parseNesButtonName } from "../emulator/nes-button";
import type { InputHub } from "./input-hub";

const DPAD_DEADZONE_RATIO = 0.2;
// Diagonals only trigger within ±15° of 45°, so cardinal directions are easier to hold
const DPAD_AXIS_ACTIVATION = Math.sin(Math.PI / 6);
// A thumb resting on the seam between A and B presses both, like on the original controller
const ACTION_COMBO_BAND_RATIO = 0.5;
const ACTION_MAX_REACH_RATIO = 1.6;

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

export interface ActionButtonArea {
  button: NesButton;
  centerX: number;
  centerY: number;
  radius: number;
}

/** Picks the closest action button, or both when the touch sits between them. */
export function resolveActionButtons(pointX: number, pointY: number, areas: ActionButtonArea[]): NesButton[] {
  const [nearest, second] = areas
    .map((area) => ({ ...area, distance: Math.hypot(pointX - area.centerX, pointY - area.centerY) }))
    .sort((first, next) => first.distance - next.distance);

  if (!nearest || nearest.distance > nearest.radius * ACTION_MAX_REACH_RATIO) return [];
  if (second && second.distance - nearest.distance < nearest.radius * ACTION_COMBO_BAND_RATIO) {
    return [nearest.button, second.button];
  }
  return [nearest.button];
}

type PointerTarget = "dpad" | "actions" | "buttons";

interface TrackedPointer {
  target: PointerTarget;
  buttons: NesButton[];
}

interface TouchInputOptions {
  onPress?: () => void;
}

function readActionAreas(cluster: HTMLElement): ActionButtonArea[] {
  return [...cluster.querySelectorAll<HTMLElement>("[data-nes-button]")].flatMap((element) => {
    const button = parseNesButtonName(element.dataset.nesButton);
    if (button === undefined) return [];

    const bounds = element.getBoundingClientRect();
    return [
      {
        button,
        centerX: bounds.left + bounds.width / 2,
        centerY: bounds.top + bounds.height / 2,
        // The capsule halves are rotated, so the shorter side of their bounding box approximates the thumb reach
        radius: Math.min(bounds.width, bounds.height) / 2,
      },
    ];
  });
}

/**
 * Handles every on-screen control inside `root`. Moves are tracked on window,
 * so fingers can slide across the D-pad or between A and B without lifting.
 */
export function bindTouchInput(root: HTMLElement, hub: InputHub, { onPress }: TouchInputOptions = {}): () => void {
  const dpad = root.querySelector<HTMLElement>("[data-dpad]");
  const actionCluster = root.querySelector<HTMLElement>("[data-action-cluster]");
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

    if (pointer.target === "actions" && actionCluster) {
      return resolveActionButtons(event.clientX, event.clientY, readActionAreas(actionCluster));
    }

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const button = parseNesButtonName(element?.closest<HTMLElement>("[data-nes-button]")?.dataset.nesButton);
    return button === undefined ? [] : [button];
  };

  const resolvePointerTarget = (element: Element | null): PointerTarget | null => {
    if (!element) return null;
    if (dpad?.contains(element)) return "dpad";
    if (actionCluster?.contains(element)) return "actions";
    return element.closest("[data-nes-button]") ? "buttons" : null;
  };

  const syncPressedButtons = () => {
    const nextButtons = new Set([...pointers.values()].flatMap((pointer) => pointer.buttons));
    const hasNewPress = [...nextButtons].some((button) => !pressedButtons.has(button));

    pressedButtons = nextButtons;
    hub.syncSource("touch", nextButtons);
    renderPressedState(root, nextButtons);

    if (hasNewPress) onPress?.();
  };

  const handlePointerDown = (event: PointerEvent) => {
    const target = resolvePointerTarget(event.target instanceof Element ? event.target : null);
    if (!target) return;

    event.preventDefault();

    const pointer: TrackedPointer = { target, buttons: [] };
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

  // Long presses must not start a text selection: on iOS that is what shows the magnifier
  const preventDefault = (event: Event) => event.preventDefault();

  root.addEventListener("pointerdown", handlePointerDown);
  root.addEventListener("contextmenu", preventDefault);
  root.addEventListener("selectstart", preventDefault);
  window.addEventListener("pointermove", handlePointerMove);
  window.addEventListener("pointerup", handlePointerEnd);
  window.addEventListener("pointercancel", handlePointerEnd);

  return () => {
    root.removeEventListener("pointerdown", handlePointerDown);
    root.removeEventListener("contextmenu", preventDefault);
    root.removeEventListener("selectstart", preventDefault);
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
