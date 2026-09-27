import type { RomEntry } from "../library/rom-entry";
import { createElement } from "../utils/dom";
import { formatBytes } from "../utils/format";
import { renderIcon } from "./icons";

interface LibraryViewOptions {
  list: HTMLUListElement;
  onPlay: (romId: string) => void;
  onRemove: (romId: string) => void;
}

function getInitials(title: string): string {
  const words = title.split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

function describeEntry(entry: RomEntry): string {
  if (entry.source === "user") {
    return ["Tu ROM", entry.sizeBytes ? formatBytes(entry.sizeBytes) : null].filter(Boolean).join(" · ");
  }
  return [entry.year, entry.genre, entry.author].filter(Boolean).join(" · ") || "Incluido";
}

export class LibraryView {
  private readonly list: HTMLUListElement;
  private readonly onPlay: (romId: string) => void;
  private readonly onRemove: (romId: string) => void;

  constructor({ list, onPlay, onRemove }: LibraryViewOptions) {
    this.list = list;
    this.onPlay = onPlay;
    this.onRemove = onRemove;
  }

  render(entries: RomEntry[], activeRomId: string | null): void {
    if (entries.length === 0) {
      this.list.replaceChildren(
        createElement("li", {
          className: "px-1 py-6 text-center text-sm text-muted",
          textContent: "Aún no hay juegos. Agrega tu primera ROM.",
        }),
      );
      return;
    }

    this.list.replaceChildren(...entries.map((entry) => this.renderItem(entry)));
    this.setActive(activeRomId);
  }

  setActive(activeRomId: string | null): void {
    for (const item of this.list.querySelectorAll<HTMLLIElement>("[data-rom-id]")) {
      const isActive = item.dataset.romId === activeRomId;
      item.toggleAttribute("data-active", isActive);
      item.querySelector(".rom-play")?.toggleAttribute("aria-current", isActive);
    }
  }

  focusFirstItem(): void {
    this.list.querySelector<HTMLButtonElement>(".rom-play")?.focus();
  }

  private renderItem(entry: RomEntry): HTMLLIElement {
    const playButton = createElement("button", { type: "button", className: "rom-play" }, [
      createElement("span", { className: "rom-cover", textContent: getInitials(entry.title) }),
      createElement("span", { className: "flex min-w-0 flex-col" }, [
        createElement("span", { className: "truncate font-semibold", textContent: entry.title }),
        createElement("span", { className: "truncate text-xs text-muted", textContent: describeEntry(entry) }),
      ]),
    ]);
    playButton.addEventListener("click", () => this.onPlay(entry.id));

    const item = createElement("li", { className: "rom-item" }, [playButton]);
    item.dataset.romId = entry.id;

    if (entry.source === "user") {
      const removeButton = createElement("button", {
        type: "button",
        className: "icon-button mr-1",
        title: "Quitar de la biblioteca",
        innerHTML: renderIcon("trash", "size-4"),
      });
      removeButton.setAttribute("aria-label", `Quitar ${entry.title}`);
      removeButton.addEventListener("click", () => this.onRemove(entry.id));
      item.append(removeButton);
    }

    return item;
  }
}
