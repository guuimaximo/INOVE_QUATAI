import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    strictPort: false,
    // Mitiga GHSA-67mh-4wv8-2f99 (SSRF / DNS rebinding contra o dev server).
    // Apenas hostnames listados podem acessar o dev server.
    allowedHosts: ['localhost', '127.0.0.1'],
  },
  build: {
    target: "es2019",
    sourcemap: false,
  },
})
