import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // 另起一个后端（比如别的端口上带着不同配置）时用 API_TARGET 指过去
      '/api': process.env.API_TARGET ?? 'http://localhost:8080',
    },
  },
})