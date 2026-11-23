import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// En desarrollo, /api se envía al servidor PHP local (php -S 127.0.0.1:8000).
const api = { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: true } }

export default defineConfig({
  plugins: [react()],
  server: { proxy: api },
  preview: { proxy: api },
})
