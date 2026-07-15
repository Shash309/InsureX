import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

if (!process.env.VITE_API_URL) {
  console.warn("VITE_API_URL not set, using localhost:8001")
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
