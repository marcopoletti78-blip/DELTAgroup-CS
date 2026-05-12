import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        /** Allinea al proxy Node: generazioni lunghe senza ECONNRESET prematuro */
        timeout: 300_000,
      },
    },
  },
})
