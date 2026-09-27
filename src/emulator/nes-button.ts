import { Controller } from "jsnes";

export const NesButton = {
  A: Controller.BUTTON_A,
  B: Controller.BUTTON_B,
  SELECT: Controller.BUTTON_SELECT,
  START: Controller.BUTTON_START,
  UP: Controller.BUTTON_UP,
  DOWN: Controller.BUTTON_DOWN,
  LEFT: Controller.BUTTON_LEFT,
  RIGHT: Controller.BUTTON_RIGHT,
} as const;

export type NesButtonName = keyof typeof NesButton;
export type NesButton = (typeof NesButton)[NesButtonName];

export function parseNesButtonName(value: string | undefined): NesButton | undefined {
  if (value === undefined || !(value in NesButton)) return undefined;
  return NesButton[value as NesButtonName];
}

export function getNesButtonName(button: NesButton): NesButtonName {
  const entry = Object.entries(NesButton).find(([, value]) => value === button);
  return entry![0] as NesButtonName;
}
