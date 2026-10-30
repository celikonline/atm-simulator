import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Yerelde /api istekleri Flask'a (python api/index.py) yönlenir.
// Vercel'de ise vercel.json içindeki rewrite devreye girer.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': 'http://127.0.0.1:5328' },
  },
})
