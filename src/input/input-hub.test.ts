import { describe, expect, it, vi } from "vitest";
import { NesButton } from "../emulator/nes-button";
import { InputHub } from "./input-hub";

function createHub() {
  const target = { pressButton: vi.fn(), releaseButton: vi.fn() };
  return { hub: new InputHub(target), target };
}

describe("InputHub", () => {
  it("keeps a button pressed while any source holds it", () => {
    const { hub, target } = createHub();

    hub.setButton("keyboard", NesButton.A, true);
    hub.setButton("touch", NesButton.A, true);
    hub.setButton("keyboard", NesButton.A, false);

    expect(target.pressButton).toHaveBeenCalledTimes(1);
    expect(target.releaseButton).not.toHaveBeenCalled();

    hub.setButton("touch", NesButton.A, false);
    expect(target.releaseButton).toHaveBeenCalledWith(NesButton.A);
  });

  it("syncs a source to an exact set of buttons", () => {
    const { hub, target } = createHub();

    hub.syncSource("gamepad", [NesButton.UP, NesButton.B]);
    hub.syncSource("gamepad", [NesButton.B]);

    expect(target.pressButton.mock.calls).toEqual([[NesButton.UP], [NesButton.B]]);
    expect(target.releaseButton.mock.calls).toEqual([[NesButton.UP]]);
    expect(hub.isPressed(NesButton.B)).toBe(true);
  });

  it("releases every source at once", () => {
    const { hub, target } = createHub();

    hub.setButton("keyboard", NesButton.START, true);
    hub.setButton("touch", NesButton.LEFT, true);
    hub.releaseAll();

    expect(target.releaseButton).toHaveBeenCalledWith(NesButton.START);
    expect(target.releaseButton).toHaveBeenCalledWith(NesButton.LEFT);
    expect(hub.isPressed(NesButton.START)).toBe(false);
  });
});
