import type { NesButton } from "../emulator/nes-button";

export type InputSource = "keyboard" | "touch" | "gamepad";

export interface ButtonTarget {
  pressButton(button: NesButton): void;
  releaseButton(button: NesButton): void;
}

/**
 * Merges every input device into a single controller so a button stays
 * pressed while any source holds it (e.g. keyboard and touch at once).
 */
export class InputHub {
  private readonly pressedBySource = new Map<InputSource, Set<NesButton>>();

  constructor(private readonly target: ButtonTarget) {}

  setButton(source: InputSource, button: NesButton, pressed: boolean): void {
    const wasPressed = this.isPressed(button);
    const sourceButtons = this.getSourceButtons(source);

    if (pressed) sourceButtons.add(button);
    else sourceButtons.delete(button);

    this.notifyChange(button, wasPressed);
  }

  syncSource(source: InputSource, buttons: Iterable<NesButton>): void {
    const nextButtons = new Set(buttons);
    const currentButtons = this.getSourceButtons(source);

    for (const button of currentButtons) {
      if (!nextButtons.has(button)) this.setButton(source, button, false);
    }
    for (const button of nextButtons) {
      if (!currentButtons.has(button)) this.setButton(source, button, true);
    }
  }

  releaseSource(source: InputSource): void {
    this.syncSource(source, []);
  }

  releaseAll(): void {
    for (const source of this.pressedBySource.keys()) this.releaseSource(source);
  }

  isPressed(button: NesButton): boolean {
    for (const buttons of this.pressedBySource.values()) {
      if (buttons.has(button)) return true;
    }
    return false;
  }

  private getSourceButtons(source: InputSource): Set<NesButton> {
    let buttons = this.pressedBySource.get(source);
    if (!buttons) {
      buttons = new Set();
      this.pressedBySource.set(source, buttons);
    }
    return buttons;
  }

  private notifyChange(button: NesButton, wasPressed: boolean): void {
    const isPressed = this.isPressed(button);
    if (isPressed === wasPressed) return;

    if (isPressed) this.target.pressButton(button);
    else this.target.releaseButton(button);
  }
}
