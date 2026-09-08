/** Register the Web Shell service worker when running as a static site / PWA. */
export function registerServiceWorker(): void {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  // Desktop / file / test harnesses should not pin an offline shell.
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  const params = new URLSearchParams(location.search);
  if (params.has("testMode") || params.get("nopwa") === "1") return;
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register(new URL("./sw.js", location.href), {
      scope: "./",
    }).catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
