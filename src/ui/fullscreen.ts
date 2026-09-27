export function isFullscreenSupported(): boolean {
  return document.fullscreenEnabled === true;
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

export async function toggleFullscreen(element: HTMLElement): Promise<void> {
  if (isFullscreen()) {
    await document.exitFullscreen();
    return;
  }
  await element.requestFullscreen({ navigationUI: "hide" });
}
