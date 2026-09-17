import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// Deliberately self-contained: this is a separate client product from the app in ../src,
// so it gets its own entry, router and styles. `root` and the PostCSS path are pinned to
// this folder so the server behaves the same however it is launched, and dependencies
// resolve up the tree to ../node_modules — which is why there is no install step here.
export default defineConfig({
  root: here,
  plugins: [react()],
  css: { postcss: resolve(here, 'postcss.config.js') },
  cacheDir: resolve(here, '.vite'),
  server: { port: 5180, strictPort: false },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Charts are only needed on Overview and Reports, and they dominate the bundle —
        // splitting them keeps the first paint of the operational screens light.
        manualChunks: {
          charts: ['recharts'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
