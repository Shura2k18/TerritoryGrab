import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path/win32'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@territory/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 3000, 
    strictPort: true,
  }
})
