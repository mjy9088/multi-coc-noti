import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Multi Village Command Center",
    short_name: "Multi Village",
    description: "Track Clash of Clans upgrades, available slots, and Bark alerts across villages.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f3ec",
    theme_color: "#27333b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
