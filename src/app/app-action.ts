export const APP_ACTIONS = [
  "toggle-pause",
  "reset",
  "save-state",
  "load-state",
  "toggle-mute",
  "toggle-fullscreen",
  "open-library",
  "close-library",
  "open-help",
  "close-help",
  "close-install",
] as const;

export type AppAction = (typeof APP_ACTIONS)[number];

export function isAppAction(value: string | undefined): value is AppAction {
  return APP_ACTIONS.includes(value as AppAction);
}
