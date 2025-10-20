import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ['truevoice.digital', 'www.truevoice.digital'],
    host: true,
    port: 8080,
  },
})
