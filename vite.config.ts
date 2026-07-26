import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Deployed at https://<owner>.github.io/onflows-care/
// Change `base` to '/' if this ever moves to a custom domain or a user site.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/onflows-care/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@docs': path.resolve(import.meta.dirname, 'docs'),
    },
  },
})
