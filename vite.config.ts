import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { blameScopePlugin } from './src/blamescope/plugin'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    blameScopePlugin(),
    react(),
  ],
})
