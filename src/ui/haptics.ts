const VIBRATION_PULSE_MS = 12;
const TOUCH_DEVICE_QUERY = "(hover: none) and (pointer: coarse)";

export type HapticsStrategy = "vibration" | "ios-switch" | "none";

interface HapticsEnvironment {
  isTouchDevice: boolean;
  canVibrate: boolean;
  supportsSwitchInput: boolean;
}

export function resolveHapticsStrategy({ isTouchDevice, canVibrate, supportsSwitchInput }: HapticsEnvironment): HapticsStrategy {
  if (!isTouchDevice) return "none";
  if (canVibrate) return "vibration";
  // Safari has no Vibration API, but toggling a native switch plays the system haptic (iOS 18+)
  if (supportsSwitchInput) return "ios-switch";
  return "none";
}

function readHapticsEnvironment(): HapticsEnvironment {
  return {
    isTouchDevice: window.matchMedia(TOUCH_DEVICE_QUERY).matches,
    canVibrate: typeof navigator.vibrate === "function",
    supportsSwitchInput: "switch" in document.createElement("input"),
  };
}

/**
 * Soft tap feedback for the on-screen controller. Android vibrates on press;
 * iOS only allows haptics from a real tap on a switch, so an invisible switch
 * is layered over each button and the tick plays when the tap completes.
 */
export class Haptics {
  readonly strategy: HapticsStrategy;
  private enabled: boolean;
  private readonly switchOverlays: HTMLInputElement[] = [];

  constructor({ enabled, environment = readHapticsEnvironment() }: { enabled: boolean; environment?: HapticsEnvironment }) {
    this.enabled = enabled;
    this.strategy = resolveHapticsStrategy(environment);
  }

  get isSupported(): boolean {
    return this.strategy !== "none";
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    for (const overlay of this.switchOverlays) overlay.classList.toggle("haptic-switch-off", !enabled);
  }

  readonly pulse = (): void => {
    if (this.enabled && this.strategy === "vibration") navigator.vibrate(VIBRATION_PULSE_MS);
  };

  attachTo(buttons: Iterable<HTMLElement>): void {
    if (this.strategy !== "ios-switch") return;

    for (const button of buttons) {
      const overlay = document.createElement("input");
      overlay.type = "checkbox";
      overlay.setAttribute("switch", "");
      overlay.tabIndex = -1;
      overlay.setAttribute("aria-hidden", "true");
      overlay.className = "haptic-switch";
      overlay.classList.toggle("haptic-switch-off", !this.enabled);

      button.append(overlay);
      this.switchOverlays.push(overlay);
    }
  }
}
