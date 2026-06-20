"use client";

import { useEffect } from "react";

// Runs once on mount: registers the service worker (home-screen install + offline shell).
// Fails silently — the SW is an enhancement, not a requirement.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
