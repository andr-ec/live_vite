import path from "path"
import { defineConfig } from "vite"

import vue from "@vitejs/plugin-vue"
import react from "@vitejs/plugin-react"

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isDev = false

  return {
    base: "/assets",
    plugins: [vue(), react({ include: /\.(tsx|jsx)$/ })],
    resolve: {
      alias: {
        vue: path.resolve(__dirname, "../../node_modules/vue"),
        react: path.resolve(__dirname, "../../node_modules/react"),
        "react-dom": path.resolve(__dirname, "../../node_modules/react-dom"),
        "@": path.resolve(__dirname, "."),
        live_vite: path.resolve(__dirname, "../../assets/index.ts"),
      },
    },
    build: {
      commonjsOptions: { transformMixedEsModules: true },
      target: "es2020",
      outDir: path.resolve(__dirname, "./priv/static/assets"),
      emptyOutDir: true,
      sourcemap: isDev,
      manifest: false,
      rollupOptions: {
        input: {
          app: path.resolve(__dirname, "./js/app.js"),
        },
        output: {
          // remove hashes to match phoenix way of handling assets
          entryFileNames: "[name].js",
          chunkFileNames: "[name].js",
          assetFileNames: "[name][extname]",
        },
      },
    },
  }
})
