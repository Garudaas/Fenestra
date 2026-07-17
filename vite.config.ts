import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.png"],
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/webhook-chat/],
      },
      manifest: {
        name: "Alumni Inner Circle",
        short_name: "Alumni IC",
        description: "Private and secure network for classmates",
        theme_color: "#0f1729",
        background_color: "#0f1729",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        categories: ["social", "education"],
        icons: [
          {
            src: "/icon.png",
            sizes: "48x48",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "72x72",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "96x96",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "128x128",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "144x144",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "152x152",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "384x384",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      "/webhook-chat": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
})
