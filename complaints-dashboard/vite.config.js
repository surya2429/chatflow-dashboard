import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

// Deliberately self-contained: this is its own product, unrelated to the WhatsApp app in
// ../src. `root` and the PostCSS path are pinned to this folder so the server behaves the
// same however it is launched, and dependencies resolve up the tree to ../node_modules —
// which is why there is no install step here.
export default defineConfig({
  root: here,
  plugins: [react()],
  css: { postcss: resolve(here, 'postcss.config.js') },
  cacheDir: resolve(here, '.vite'),
  // `host: true` binds IPv4 as well as IPv6. Vite's default on Windows listens only on
  // [::1], so anything resolving `localhost` to 127.0.0.1 silently fails to connect.
  server: { port: 5181, strictPort: false, host: true },
  build: {
    outDir: resolve(here, 'dist'),
    emptyOutDir: true,
  },
})
