import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

// SmatBot's staff admin panel. It has no server of its own: everything goes to the billing API
// (/api/billing/admin/*). In development the ChatFlow dashboard's dev server answers /api, so it is
// proxied there; in production set VITE_API_BASE_URL to the backend (and VITE_DASHBOARD_URL to the dashboard).
export default defineConfig({
  root: __dirname,
  plugins: [react()],
  // host: true — Vite's default bind here only listens on [::1], which browsers resolving
  // localhost to 127.0.0.1 can't reach (same as the dashboard's config).
  server: { port: 5174, host: true, proxy: { '/api': process.env.API_PROXY_TARGET || 'http://localhost:5173' } },
})
