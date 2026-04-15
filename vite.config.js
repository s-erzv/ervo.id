import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  
  plugins: [
    react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
        manifest: {
          name: 'ervo.id',
          short_name: 'ervo.id',
          description: 'Aplikasi Manajemen Pesanan, Stok, dan Keuangan.',
          theme_color: '#ffffff',
          icons: [
            {
              src: '/logo.png',  
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/logo.png',  
              sizes: '512x512',
              type: 'image/png'
            }
          ]
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 3145728, 
        }
      })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})