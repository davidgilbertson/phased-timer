import {defineConfig} from "vite";
import {VitePWA} from "vite-plugin-pwa";

const APP_DISPLAY_NAME = "Phased Timer";

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["**/*", "!_headers", "!**/_headers"],
      manifest: {
        id: "/",
        name: APP_DISPLAY_NAME,
        short_name: APP_DISPLAY_NAME,
        description: "A simple hold/rest interval timer.",
        start_url: "/",
        display: "standalone",
        orientation: "portrait",
        theme_color: "#04060f",
        background_color: "#04060f",
        icons: [
          {
            src: "/icon-v2-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icon-v2-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
      },
    }),
  ],
  server: {
    port: 8080,
  },
});
