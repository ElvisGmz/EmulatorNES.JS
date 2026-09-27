import { isTypingTarget } from "../input/keyboard-input";
import type { AppAction } from "./app-action";

export const KEYBOARD_SHORTCUTS: Readonly<Record<string, AppAction>> = {
  KeyP: "toggle-pause",
  KeyR: "reset",
  KeyM: "toggle-mute",
  KeyF: "toggle-fullscreen",
  F2: "save-state",
  F4: "load-state",
};

export function bindKeyboardShortcuts(runAction: (action: AppAction) => void): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;

    const action = Object.hasOwn(KEYBOARD_SHORTCUTS, event.code) ? KEYBOARD_SHORTCUTS[event.code] : undefined;
    if (!action) return;

    event.preventDefault();
    runAction(action);
  };

  document.addEventListener("keydown", handleKeyDown);
  return () => document.removeEventListener("keydown", handleKeyDown);
}
