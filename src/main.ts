import "./styles.css";
import { startApp } from "./app/app";
import { detectBrowserSupport } from "./compat/browser-support";
import { showBrowserLimitationsBanner, showUnsupportedBrowserNotice } from "./compat/compat-notice";

// Tells the fallback in index.html that the bundle ran; from here on compatibility is handled in TS
document.documentElement.dataset.appReady = "true";

const browserSupport = detectBrowserSupport();

if (browserSupport.missingRequired.length > 0) {
  showUnsupportedBrowserNotice(browserSupport);
} else {
  void startApp();
  showBrowserLimitationsBanner(browserSupport);
}
