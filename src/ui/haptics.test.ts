import { describe, expect, it } from "vitest";
import { resolveHapticsStrategy } from "./haptics";

describe("resolveHapticsStrategy", () => {
  it("vibrates on Android phones", () => {
    expect(resolveHapticsStrategy({ isTouchDevice: true, canVibrate: true, supportsSwitchInput: false })).toBe("vibration");
  });

  it("uses the native switch trick on iPhone, where Safari has no Vibration API", () => {
    expect(resolveHapticsStrategy({ isTouchDevice: true, canVibrate: false, supportsSwitchInput: true })).toBe("ios-switch");
  });

  it("does nothing on desktop even if the APIs exist", () => {
    expect(resolveHapticsStrategy({ isTouchDevice: false, canVibrate: true, supportsSwitchInput: true })).toBe("none");
  });

  it("does nothing on touch devices without any haptic support", () => {
    expect(resolveHapticsStrategy({ isTouchDevice: true, canVibrate: false, supportsSwitchInput: false })).toBe("none");
  });
});
