export type RequiredFeature = "canvas" | "animation-frame" | "fetch" | "pointer-events";
export type OptionalFeature = "audio" | "storage";

export interface BrowserSupport {
  missingRequired: RequiredFeature[];
  missingOptional: OptionalFeature[];
  isSecureContext: boolean;
  isIos: boolean;
}

export interface BrowserEnvironment {
  isSecureContext: boolean;
  navigator: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">;
  hasCanvas2d: boolean;
  has: (globalName: string) => boolean;
}

export function isIosDevice({ userAgent, platform, maxTouchPoints }: BrowserEnvironment["navigator"]): boolean {
  // iPadOS reports itself as a Mac, touch support gives it away
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

export function detectBrowserSupport(environment: BrowserEnvironment = readBrowserEnvironment()): BrowserSupport {
  const { has } = environment;

  const requiredChecks: Record<RequiredFeature, boolean> = {
    canvas: environment.hasCanvas2d,
    "animation-frame": has("requestAnimationFrame"),
    fetch: has("fetch"),
    "pointer-events": has("PointerEvent"),
  };
  const optionalChecks: Record<OptionalFeature, boolean> = {
    audio: environment.isSecureContext && has("AudioContext") && has("AudioWorkletNode"),
    storage: has("indexedDB"),
  };

  return {
    missingRequired: missingKeys(requiredChecks),
    missingOptional: missingKeys(optionalChecks),
    isSecureContext: environment.isSecureContext,
    isIos: isIosDevice(environment.navigator),
  };
}

function missingKeys<T extends string>(checks: Record<T, boolean>): T[] {
  return (Object.keys(checks) as T[]).filter((key) => !checks[key]);
}

function readBrowserEnvironment(): BrowserEnvironment {
  const globals = window as unknown as Record<string, unknown>;
  return {
    isSecureContext: window.isSecureContext,
    navigator,
    hasCanvas2d: Boolean(document.createElement("canvas").getContext?.("2d")),
    has: (globalName) => globals[globalName] !== undefined,
  };
}
