import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // This allows the Cloudflare environment variable API_KEY to be accessed via process.env.API_KEY in the code
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY)
  }
})