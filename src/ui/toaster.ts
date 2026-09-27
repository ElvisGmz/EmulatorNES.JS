import { createElement } from "../utils/dom";

const TOAST_DURATION_MS = 3500;

export type ToastTone = "info" | "error";

export class Toaster {
  constructor(private readonly region: HTMLElement) {}

  show(message: string, tone: ToastTone = "info"): void {
    const toast = createElement("div", { className: "toast", textContent: message });
    toast.dataset.tone = tone;
    toast.setAttribute("role", tone === "error" ? "alert" : "status");

    this.region.append(toast);
    window.setTimeout(() => toast.remove(), TOAST_DURATION_MS);
  }
}
