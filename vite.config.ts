import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const emitSourcemaps = mode === 'development'
  const base = process.env.VITE_BASE_PATH || '/skilldna/'
  const backend = { target: 'http://127.0.0.1:8000', changeOrigin: true }

  return {
    base,
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    server: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
      strictPort: true,
      // The app calls `${base}api/v1` (same shape as the nginx subpath config in production)
      proxy: {
        [`^${base}api/`]: { ...backend, ws: true, rewrite: (p: string) => p.slice(base.length - 1) },
        [`^${base}health`]: { ...backend, rewrite: (p: string) => p.slice(base.length - 1) },
        '/api': backend,
      },
      watch: {
        ignored: ['**/backend/**'],
      },
    },
    preview: {
      host: '0.0.0.0',
      port: parseInt(process.env.PORT || '8443'),
    },
  }
})
