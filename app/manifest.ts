import type { MetadataRoute } from "next";

// Web app manifest — makes MediGuard installable to the home screen (PWA). Next auto-injects the
// <link rel="manifest">. Icons are served by the dynamic /pwa-icon/[size] route (no binary asset
// committed). Brand: yellow theme on the cool-neutral background.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MediGuard — Medication Safety",
    short_name: "MediGuard",
    description:
      "Record your doctor visit. Get a full safety audit. Never miss a dose.",
    start_url: "/",
    display: "standalone",
    background_color: "#F2F6FC",
    theme_color: "#FFD84D",
    icons: [
      {
        src: "/pwa-icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
