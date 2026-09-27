import { requireElement } from "../utils/dom";

export function queryDomRefs() {
  return {
    screen: requireElement("[data-screen]"),
    canvas: requireElement<HTMLCanvasElement>("[data-screen-canvas]"),
    nowPlaying: requireElement("[data-now-playing]"),
    touchControls: requireElement("[data-touch-controls]"),
    library: requireElement("[data-library]"),
    romList: requireElement<HTMLUListElement>("[data-rom-list]"),
    romInput: requireElement<HTMLInputElement>("[data-rom-input]"),
    helpDialog: requireElement<HTMLDialogElement>("[data-help-dialog]"),
    installDialog: requireElement<HTMLDialogElement>("[data-install-dialog]"),
    hapticsSetting: requireElement("[data-haptics-setting]"),
    hapticsToggle: requireElement<HTMLInputElement>("[data-haptics-toggle]"),
    dropOverlay: requireElement("[data-drop-overlay]"),
    toasts: requireElement("[data-toasts]"),
    pauseButton: requireElement<HTMLButtonElement>('.toolbar [data-action="toggle-pause"]'),
    muteButton: requireElement<HTMLButtonElement>('[data-action="toggle-mute"]'),
    fullscreenButton: requireElement<HTMLButtonElement>('[data-action="toggle-fullscreen"]'),
    gameButtons: document.querySelectorAll<HTMLButtonElement>("[data-requires-game]"),
  };
}

export type DomRefs = ReturnType<typeof queryDomRefs>;
