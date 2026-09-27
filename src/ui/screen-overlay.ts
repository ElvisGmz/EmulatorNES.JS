export type ScreenOverlay = "empty" | "loading" | "paused" | "crashed" | "none";

export function showScreenOverlay(screen: HTMLElement, overlay: ScreenOverlay): void {
  for (const element of screen.querySelectorAll<HTMLElement>("[data-overlay]")) {
    element.hidden = element.dataset.overlay !== overlay;
  }
}
