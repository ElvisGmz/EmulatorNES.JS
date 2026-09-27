import type { BrowserSupport, OptionalFeature } from "./browser-support";

export const CHROME_DOWNLOAD_URL = "https://www.google.com/chrome/";

export interface BrowserRecommendation {
  text: string;
  actionLabel?: string;
  actionUrl?: string;
}

export function getBrowserRecommendation({ isIos }: Pick<BrowserSupport, "isIos">): BrowserRecommendation {
  // Every iOS browser runs on Safari's engine, so switching to Chrome there changes nothing
  if (isIos) {
    return { text: "En iPhone y iPad actualiza iOS a la última versión desde Ajustes › General › Actualización de software." };
  }
  return {
    text: "Para jugar sin problemas usa la versión más reciente de Google Chrome.",
    actionLabel: "Descargar Google Chrome",
    actionUrl: CHROME_DOWNLOAD_URL,
  };
}

const LIMITATION_MESSAGES: Record<OptionalFeature, string> = {
  audio: "no puede reproducir el sonido del emulador, así que los juegos no tendrán audio",
  storage: "no permite guardar ROMs ni partidas, se perderán al cerrar la página",
};

export interface LimitationNotice {
  message: string;
  suggestBrowser: boolean;
}

export function describeLimitations(
  support: Pick<BrowserSupport, "missingOptional" | "isSecureContext">,
): LimitationNotice | null {
  const { missingOptional, isSecureContext } = support;
  if (missingOptional.length === 0) return null;

  // Audio worklets are disabled on plain http (e.g. testing from a phone on the LAN); another browser won't help
  if (!isSecureContext && missingOptional.includes("audio")) {
    return { message: "El sonido solo funciona si abres la página con https (o en localhost).", suggestBrowser: false };
  }

  const limitations = missingOptional.map((feature) => LIMITATION_MESSAGES[feature]);
  return { message: `Tu navegador ${limitations.join(" y ")}.`, suggestBrowser: true };
}
