import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Portfolio API endpoints from the FastAPI backend
const PORTFOLIO_ENDPOINTS = ['/api/ai_predict', '/api/1factor', '/api/3factors', '/api/4factors', '/api/5factors'];

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://fc-data.ssi.com.vn',
        changeOrigin: true,
        rewrite: (path) => {
          // Special case for the FastAPI endpoints
          if (PORTFOLIO_ENDPOINTS.some(endpoint => path.startsWith(endpoint))) {
            // Proxy to local FastAPI backend
            return path.replace(/^\/api/, '');
          }
          return path.replace(/^\/api/, '/api/v2');
        },
        secure: false,
        configure: (proxy) => {
          // Custom handling for FastAPI endpoints
          proxy.on('proxyReq', (proxyReq, req, res, options) => {
            // If it's a request to any portfolio endpoint, change the target to local FastAPI
            if (req.url && PORTFOLIO_ENDPOINTS.some(endpoint => req.url?.startsWith(endpoint))) {
              options.target = 'http://127.0.0.1:8000';
            }
          });
        }
      },
      '/ai-api': {
        target: 'http://47.129.232.235:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ai-api/, ''),
        secure: false
      }
    }
  }
})
