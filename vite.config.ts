import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const isTauri = process.env.TAURI_ENV_PLATFORM !== undefined

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  server: {
    strictPort: isTauri,
    port: 5173,
    proxy: isTauri ? undefined : {
      '/landing': {
        target: 'http://localhost:5174',
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    target: isTauri ? ['chrome105', 'safari13'] : 'esnext',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
})
