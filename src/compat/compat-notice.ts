import { renderIcon } from "../ui/icons";
import { createElement, requireElement } from "../utils/dom";
import { readLocalFlag, writeLocalFlag } from "../utils/storage";
import type { BrowserSupport } from "./browser-support";
import { describeLimitations, getBrowserRecommendation } from "./compat-messages";

const DISMISSED_STORAGE_KEY_PREFIX = "emulator-nes-js:compat-dismissed:";

/** Reuses the static fallback from index.html, which also covers browsers that cannot run the app bundle. */
export function showUnsupportedBrowserNotice(support: BrowserSupport): void {
  const notice = requireElement("#unsupported-browser");
  const message = requireElement("#unsupported-browser-message", notice);
  const action = requireElement<HTMLAnchorElement>("#unsupported-browser-action", notice);
  const recommendation = getBrowserRecommendation(support);

  message.textContent = `Este emulador necesita funciones que tu navegador no tiene. ${recommendation.text}`;
  action.hidden = !recommendation.actionUrl;
  if (recommendation.actionUrl && recommendation.actionLabel) {
    action.href = recommendation.actionUrl;
    action.textContent = recommendation.actionLabel;
  }
  notice.hidden = false;
}

export function showBrowserLimitationsBanner(support: BrowserSupport): void {
  const limitations = describeLimitations(support);
  if (!limitations) return;

  const dismissedKey = `${DISMISSED_STORAGE_KEY_PREFIX}${support.missingOptional.join(",")}`;
  if (readLocalFlag(dismissedKey, false)) return;

  const recommendation = limitations.suggestBrowser ? getBrowserRecommendation(support) : null;
  const dismissButton = createElement("button", {
    type: "button",
    className: "icon-button -mr-2 -mt-2",
    innerHTML: renderIcon("close", "size-4"),
  });
  dismissButton.setAttribute("aria-label", "Cerrar aviso");

  const banner = createElement("aside", { className: "compat-banner" }, [
    createElement("div", { className: "flex min-w-0 flex-col gap-1.5" }, [
      createElement("p", { className: "font-semibold", textContent: "Tu navegador tiene limitaciones" }),
      createElement("p", {
        className: "text-muted",
        textContent: [limitations.message, recommendation?.text].filter(Boolean).join(" "),
      }),
      ...(recommendation?.actionUrl
        ? [
            createElement("a", {
              className: "font-semibold text-accent-strong underline-offset-4 hover:underline",
              href: recommendation.actionUrl,
              target: "_blank",
              rel: "noopener",
              textContent: recommendation.actionLabel,
            }),
          ]
        : []),
    ]),
    dismissButton,
  ]);
  banner.setAttribute("role", "status");

  dismissButton.addEventListener("click", () => {
    writeLocalFlag(dismissedKey, true);
    banner.remove();
  });

  document.body.append(banner);
}
