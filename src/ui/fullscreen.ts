// Older iPadOS Safari only ships the prefixed Fullscreen API
interface WebkitDocument extends Document {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
}

interface WebkitElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

interface StandaloneNavigator extends Navigator {
  standalone?: boolean;
}

/**
 * - native: the Fullscreen API is available (desktop, Android, iPad)
 * - install: no Fullscreen API (iPhone); adding the app to the home screen is the only way
 * - standalone: already running as an installed app, without browser UI
 */
export type FullscreenMode = "native" | "install" | "standalone";

const STANDALONE_DISPLAY_QUERY = "(display-mode: standalone), (display-mode: fullscreen)";

export function isRunningStandalone(): boolean {
  return window.matchMedia(STANDALONE_DISPLAY_QUERY).matches || (navigator as StandaloneNavigator).standalone === true;
}

export function getFullscreenMode(): FullscreenMode {
  if (isRunningStandalone()) return "standalone";

  const webkitDocument = document as WebkitDocument;
  return document.fullscreenEnabled || webkitDocument.webkitFullscreenEnabled ? "native" : "install";
}

export function isFullscreen(): boolean {
  const webkitDocument = document as WebkitDocument;
  return Boolean(document.fullscreenElement ?? webkitDocument.webkitFullscreenElement);
}

export async function toggleFullscreen(element: HTMLElement): Promise<void> {
  const webkitDocument = document as WebkitDocument;
  const webkitElement = element as WebkitElement;

  if (isFullscreen()) {
    await (document.exitFullscreen?.() ?? webkitDocument.webkitExitFullscreen?.());
    return;
  }
  await (element.requestFullscreen?.({ navigationUI: "hide" }) ?? webkitElement.webkitRequestFullscreen?.());
}

export function onFullscreenChange(listener: () => void): void {
  document.addEventListener("fullscreenchange", listener);
  document.addEventListener("webkitfullscreenchange", listener);
}
