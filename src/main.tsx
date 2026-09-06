import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

// Surface any otherwise-invisible error directly in the UI, since
// DevTools access has been unreliable while debugging — this makes
// the actual failure impossible to miss regardless of environment.
function showFatalError(message: string) {
  let banner = document.getElementById("fatal-error-banner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "fatal-error-banner";
    banner.style.cssText =
      "position:fixed;top:0;left:0;right:0;z-index:99999;background:#ff2d55;color:#fff;" +
      "font-family:monospace;font-size:12px;padding:10px 14px;white-space:pre-wrap;" +
      "max-height:40vh;overflow-y:auto;box-shadow:0 4px 20px rgba(0,0,0,0.5);";
    document.body.appendChild(banner);
  }
  banner.textContent += (banner.textContent ? "\n---\n" : "") + message;
}

window.addEventListener("error", (event) => {
  showFatalError(`ERROR: ${event.message}\n${event.error?.stack ?? ""}`);
});

window.addEventListener("unhandledrejection", (event) => {
  showFatalError(`UNHANDLED PROMISE REJECTION: ${event.reason?.message ?? event.reason}`);
});

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
