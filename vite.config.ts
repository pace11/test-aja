import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { blameScopeBabelPlugin } from './src/blamescope/plugin'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      // Only inject blame metadata during development
      babel: mode === 'development'
        ? { plugins: [blameScopeBabelPlugin()] }
        : undefined,
    }),
  ],
}))
