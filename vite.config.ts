import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Declare process to avoid TS errors
declare const process: any;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Define process.env to ensure it exists as an object, preventing crash on access
    'process.env': {
      API_KEY: process.env.API_KEY || ''
    }
  }
})