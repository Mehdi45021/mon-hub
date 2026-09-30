import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Front Vite ; /api est proxifié vers le serveur Express (port 3001)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' }
  }
})
