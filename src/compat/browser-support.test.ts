import { describe, expect, it } from "vitest";
import { detectBrowserSupport, isIosDevice, type BrowserEnvironment } from "./browser-support";
import { describeLimitations, getBrowserRecommendation } from "./compat-messages";

const MODERN_GLOBALS = ["requestAnimationFrame", "fetch", "PointerEvent", "AudioContext", "AudioWorkletNode", "indexedDB"];
const DESKTOP_CHROME = { userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/140.0", platform: "Win32", maxTouchPoints: 0 };

function createEnvironment({
  globals = MODERN_GLOBALS,
  isSecureContext = true,
  hasCanvas2d = true,
  navigator = DESKTOP_CHROME,
}: Partial<Omit<BrowserEnvironment, "has">> & { globals?: string[] } = {}): BrowserEnvironment {
  return { isSecureContext, hasCanvas2d, navigator, has: (name) => globals.includes(name) };
}

describe("detectBrowserSupport", () => {
  it("reports nothing missing on a modern browser", () => {
    expect(detectBrowserSupport(createEnvironment())).toMatchObject({ missingRequired: [], missingOptional: [] });
  });

  it("flags required features that block the emulator", () => {
    const support = detectBrowserSupport(
      createEnvironment({ hasCanvas2d: false, globals: MODERN_GLOBALS.filter((name) => name !== "PointerEvent") }),
    );
    expect(support.missingRequired).toEqual(["canvas", "pointer-events"]);
  });

  it("flags audio when AudioWorklet is missing or the page is not served over https", () => {
    const withoutWorklet = createEnvironment({ globals: MODERN_GLOBALS.filter((name) => name !== "AudioWorkletNode") });
    expect(detectBrowserSupport(withoutWorklet).missingOptional).toEqual(["audio"]);
    expect(detectBrowserSupport(createEnvironment({ isSecureContext: false })).missingOptional).toEqual(["audio"]);
  });
});

describe("isIosDevice", () => {
  it("detects iPhone and iPadOS (which reports itself as a Mac)", () => {
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)", platform: "iPhone", maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIosDevice({ userAgent: "Mozilla/5.0 (Macintosh)", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
  });
});

describe("compat messages", () => {
  it("recommends Chrome outside iOS and updating iOS on iPhone", () => {
    expect(getBrowserRecommendation({ isIos: false })).toMatchObject({ actionUrl: "https://www.google.com/chrome/" });
    const iosRecommendation = getBrowserRecommendation({ isIos: true });
    expect(iosRecommendation.text).toContain("actualiza iOS");
    expect(iosRecommendation.actionUrl).toBeUndefined();
  });

  it("does not suggest another browser when the issue is plain http", () => {
    expect(describeLimitations({ missingOptional: ["audio"], isSecureContext: false })).toMatchObject({
      suggestBrowser: false,
    });
  });

  it("joins every limitation into one sentence", () => {
    const notice = describeLimitations({ missingOptional: ["audio", "storage"], isSecureContext: true });
    expect(notice?.message).toMatch(/^Tu navegador no puede reproducir .* y no permite guardar/);
    expect(notice?.suggestBrowser).toBe(true);
  });

  it("returns nothing when there are no limitations", () => {
    expect(describeLimitations({ missingOptional: [], isSecureContext: true })).toBeNull();
  });
});
