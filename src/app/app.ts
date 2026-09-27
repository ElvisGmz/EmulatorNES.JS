import { NesEmulator, type EmulatorStatus } from "../emulator/nes-emulator";
import { bindGamepadInput } from "../input/gamepad-input";
import { InputHub } from "../input/input-hub";
import { bindKeyboardInput } from "../input/keyboard-input";
import { bindTouchInput } from "../input/touch-input";
import { RomLibrary, RomValidationError } from "../library/rom-library";
import { describeRomLoadError } from "../library/rom-validator";
import { SnapshotStore } from "../library/snapshot-store";
import { bindFileDrop } from "../ui/file-drop";
import { isFullscreen, isFullscreenSupported, toggleFullscreen } from "../ui/fullscreen";
import { hydrateIcons, setIcon } from "../ui/icons";
import { LibraryView } from "../ui/library-view";
import { showScreenOverlay, type ScreenOverlay } from "../ui/screen-overlay";
import { Toaster } from "../ui/toaster";
import { readLocalFlag, writeLocalFlag } from "../utils/storage";
import { isAppAction, type AppAction } from "./app-action";
import { queryDomRefs } from "./dom-refs";
import { bindKeyboardShortcuts } from "./shortcuts";

const MUTED_STORAGE_KEY = "emulator-nes-js:muted";
const DESKTOP_LAYOUT_QUERY = "(min-width: 64rem)";

const STATUS_OVERLAY: Record<EmulatorStatus, ScreenOverlay> = {
  idle: "empty",
  running: "none",
  paused: "paused",
  crashed: "crashed",
};

export async function startApp(): Promise<void> {
  hydrateIcons();

  const dom = queryDomRefs();
  const toaster = new Toaster(dom.toasts);
  const library = new RomLibrary({ baseUrl: import.meta.env.BASE_URL });
  const snapshots = new SnapshotStore();
  const desktopLayout = window.matchMedia(DESKTOP_LAYOUT_QUERY);

  let activeRomId: string | null = null;
  let isLoadingRom = false;
  let isMuted = readLocalFlag(MUTED_STORAGE_KEY, false);
  let pausedAutomatically = false;

  const emulator = new NesEmulator({
    canvas: dom.canvas,
    onStatusChange: renderStatus,
    onCrash: (error) => {
      console.error(error);
      toaster.show("El juego encontró un error y se detuvo.", "error");
    },
  });
  const inputHub = new InputHub(emulator);

  const libraryView = new LibraryView({
    list: dom.romList,
    onPlay: (romId) => {
      emulator.prepareAudio();
      void playRom(romId);
    },
    onRemove: (romId) => void removeRom(romId),
  });

  function renderStatus(status: EmulatorStatus): void {
    if (!isLoadingRom) showScreenOverlay(dom.screen, STATUS_OVERLAY[status]);

    const isRunning = status === "running";
    setIcon(dom.pauseButton.firstElementChild!, isRunning ? "pause" : "play");
    dom.pauseButton.setAttribute("aria-label", isRunning ? "Pausar" : "Continuar");
    dom.pauseButton.title = isRunning ? "Pausar (P)" : "Continuar (P)";

    for (const button of dom.gameButtons) button.disabled = !emulator.hasGame;
    if (!isRunning) inputHub.releaseAll();
  }

  function renderMuted(): void {
    emulator.setMuted(isMuted);
    setIcon(dom.muteButton.firstElementChild!, isMuted ? "volume-off" : "volume-on");
    dom.muteButton.toggleAttribute("data-active", isMuted);
    dom.muteButton.setAttribute("aria-label", isMuted ? "Activar sonido" : "Silenciar");
  }

  function renderFullscreen(): void {
    setIcon(dom.fullscreenButton.firstElementChild!, isFullscreen() ? "fullscreen-exit" : "fullscreen");
  }

  async function playRom(romId: string): Promise<void> {
    const entry = library.findEntry(romId);
    if (!entry || isLoadingRom) return;

    isLoadingRom = true;
    closeLibrary();
    showScreenOverlay(dom.screen, "loading");

    try {
      const romData = await library.readRom(romId);
      inputHub.releaseAll();
      emulator.loadRom(romData);
      activeRomId = romId;
      dom.nowPlaying.textContent = entry.title;
      libraryView.setActive(romId);
    } catch (error) {
      console.error(error);
      toaster.show(describeRomLoadError(error), "error");
    } finally {
      isLoadingRom = false;
      renderStatus(emulator.status);
    }
  }

  async function addRomFiles(files: File[]): Promise<void> {
    const romFiles = files.filter((file) => file.name.toLowerCase().endsWith(".nes"));
    if (romFiles.length === 0) {
      toaster.show("Solo se aceptan archivos .nes", "error");
      return;
    }

    let firstAddedRomId: string | null = null;
    let notPersistedCount = 0;

    for (const file of romFiles) {
      try {
        const { entry, persisted } = await library.addUserRom(file);
        firstAddedRomId ??= entry.id;
        if (!persisted) notPersistedCount++;
      } catch (error) {
        toaster.show(error instanceof RomValidationError ? error.message : `No se pudo leer ${file.name}`, "error");
      }
    }

    libraryView.render(library.entries, activeRomId);
    if (!firstAddedRomId) return;

    if (notPersistedCount > 0) {
      toaster.show("Este navegador no permite guardar ROMs; estarán disponibles solo en esta sesión.");
    }
    await playRom(firstAddedRomId);
  }

  async function removeRom(romId: string): Promise<void> {
    const entry = library.findEntry(romId);
    if (!entry || !window.confirm(`¿Quitar "${entry.title}" de la biblioteca?`)) return;

    await library.removeUserRom(romId);
    await snapshots.delete(romId).catch(() => {});
    libraryView.render(library.entries, activeRomId);
  }

  async function saveState(): Promise<void> {
    const snapshot = emulator.createSnapshot();
    if (!snapshot || !activeRomId) return;

    try {
      await snapshots.save(activeRomId, snapshot);
      toaster.show("Partida guardada");
    } catch (error) {
      console.error(error);
      toaster.show("No se pudo guardar la partida en este navegador.", "error");
    }
  }

  async function loadState(): Promise<void> {
    if (!activeRomId) return;

    try {
      const record = await snapshots.load(activeRomId);
      if (!record) {
        toaster.show("Aún no hay una partida guardada para este juego.");
        return;
      }
      inputHub.releaseAll();
      emulator.restoreSnapshot(record.snapshot);
      toaster.show(`Partida cargada (${new Date(record.savedAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })})`);
    } catch (error) {
      console.error(error);
      toaster.show("No se pudo cargar la partida guardada.", "error");
    }
  }

  function pauseAutomatically(): void {
    if (emulator.status !== "running") return;
    emulator.pause();
    pausedAutomatically = true;
  }

  function resumeIfPausedAutomatically(): void {
    if (!pausedAutomatically) return;
    pausedAutomatically = false;
    emulator.resume();
  }

  function openLibrary(): void {
    if (desktopLayout.matches) {
      libraryView.focusFirstItem();
      return;
    }
    dom.library.toggleAttribute("data-open", true);
    pauseAutomatically();
    dom.library.querySelector<HTMLButtonElement>('[data-action="close-library"]')?.focus();
  }

  function closeLibrary(): void {
    if (!dom.library.hasAttribute("data-open")) return;
    dom.library.removeAttribute("data-open");
    resumeIfPausedAutomatically();
  }

  const actionHandlers: Record<AppAction, () => void> = {
    "toggle-pause": () => {
      pausedAutomatically = false;
      emulator.togglePause();
    },
    reset: () => emulator.reset(),
    "save-state": () => void saveState(),
    "load-state": () => void loadState(),
    "toggle-mute": () => {
      isMuted = !isMuted;
      writeLocalFlag(MUTED_STORAGE_KEY, isMuted);
      renderMuted();
    },
    "toggle-fullscreen": () => {
      if (!isFullscreenSupported()) return;
      toggleFullscreen(dom.screen).catch(() => toaster.show("No se pudo activar la pantalla completa.", "error"));
    },
    "open-library": openLibrary,
    "close-library": closeLibrary,
    "open-help": () => {
      pauseAutomatically();
      dom.helpDialog.showModal();
    },
    "close-help": () => dom.helpDialog.close(),
  };

  const runAction = (action: AppAction) => {
    if (isGameAction(action) && !emulator.hasGame) return;
    actionHandlers[action]();
  };

  document.addEventListener("click", (event) => {
    const trigger = (event.target as Element | null)?.closest<HTMLElement>("[data-action]");
    const action = trigger?.dataset.action;
    if (isAppAction(action) && !(trigger instanceof HTMLButtonElement && trigger.disabled)) runAction(action);
  });

  // Browsers keep audio suspended until a gesture; any tap or key press unlocks it
  for (const eventName of ["pointerdown", "keydown"] as const) {
    document.addEventListener(eventName, () => emulator.unlockAudio(), { capture: true });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLibrary();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseAutomatically();
    else if (!dom.library.hasAttribute("data-open") && !dom.helpDialog.open) resumeIfPausedAutomatically();
  });

  dom.helpDialog.addEventListener("close", resumeIfPausedAutomatically);
  document.addEventListener("fullscreenchange", renderFullscreen);
  dom.fullscreenButton.hidden = !isFullscreenSupported();

  dom.romInput.addEventListener("change", () => {
    const files = [...(dom.romInput.files ?? [])];
    dom.romInput.value = "";
    emulator.prepareAudio();
    void addRomFiles(files);
  });

  bindFileDrop(dom.dropOverlay, (files) => void addRomFiles(files));
  bindKeyboardShortcuts(runAction);
  bindKeyboardInput(inputHub, { isEnabled: () => emulator.status === "running" && !dom.helpDialog.open });
  bindTouchInput(dom.touchControls, inputHub);
  bindGamepadInput(inputHub, {
    onConnectionChange: (connectedCount) => {
      if (connectedCount > 0) toaster.show("Mando conectado 🎮");
    },
  });

  renderStatus(emulator.status);
  renderMuted();
  renderFullscreen();

  libraryView.render(await library.load(), activeRomId);
}

function isGameAction(action: AppAction): boolean {
  return action === "toggle-pause" || action === "reset" || action === "save-state" || action === "load-state";
}
