function hasFiles(event: DragEvent): boolean {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

/** Accepts files dropped anywhere on the page, showing `overlay` while dragging. */
export function bindFileDrop(overlay: HTMLElement, onFiles: (files: File[]) => void): () => void {
  let dragDepth = 0;

  const setOverlayVisible = (visible: boolean) => {
    overlay.hidden = !visible;
  };

  const handleDragEnter = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth++;
    setOverlayVisible(true);
  };

  const handleDragOver = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) setOverlayVisible(false);
  };

  const handleDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth = 0;
    setOverlayVisible(false);
    onFiles([...(event.dataTransfer?.files ?? [])]);
  };

  window.addEventListener("dragenter", handleDragEnter);
  window.addEventListener("dragover", handleDragOver);
  window.addEventListener("dragleave", handleDragLeave);
  window.addEventListener("drop", handleDrop);

  return () => {
    window.removeEventListener("dragenter", handleDragEnter);
    window.removeEventListener("dragover", handleDragOver);
    window.removeEventListener("dragleave", handleDragLeave);
    window.removeEventListener("drop", handleDrop);
  };
}
