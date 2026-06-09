import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// VITE_BASE=/ for web builds; default './' keeps Electron file:// loads working
const base = process.env.VITE_BASE ?? './'
const singleFile = process.env.VITE_SINGLE_FILE === '1'

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(singleFile ? [viteSingleFile()] : [])],
  base,
  ...(singleFile ? {
    build: {
      cssCodeSplit: false,
      assetsInlineLimit: 100_000_000,
    }
  } : {}),
})
