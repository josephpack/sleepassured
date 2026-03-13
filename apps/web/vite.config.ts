import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// In dev, serve landing.html when the browser requests "/"
function landingDevRedirect(): Plugin {
  return {
    name: "landing-dev-redirect",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url === "/") {
          req.url = "/landing.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    landingDevRedirect(),
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "SleepAssured",
        short_name: "SleepAssured",
        description: "Your personalised sleep therapy companion",
        theme_color: "#6366f1",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/dashboard",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallback: "index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/$/],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: { maxEntries: 50, maxAgeSeconds: 300 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, "index.html"),
        landing: path.resolve(__dirname, "landing.html"),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
