import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: process.cwd(),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'), // <— maps "@" to /src
    },
  },
  optimizeDeps: {
    include: ['react-big-calendar'],
  },
  build: {
    commonjsOptions: {
      include: [/react-big-calendar/, /node_modules/],
    },
  },
})
