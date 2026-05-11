import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // In sviluppo locale, proxy /api verso un server locale separato
    // (oppure usa wrangler/vercel dev per simulare le funzioni serverless)
    port: 3000,
  },
})
