import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  root: 'src/renderer',
  base: './',
  html: command === 'serve' ? { cspNonce: 'drift-development' } : undefined,
  plugins: [
    react(),
    {
      name: 'development-csp',
      apply: 'serve',
      transformIndexHtml(html) {
        return html
          .replace(
            "script-src 'self'",
            "script-src 'self' 'nonce-drift-development'",
          )
          .replace(
            "style-src 'self'",
            "style-src 'self' 'nonce-drift-development'",
          )
          .replace(
            "connect-src 'self'",
            "connect-src 'self' ws://127.0.0.1:5173",
          );
      },
    },
  ],
  build: { outDir: '../../dist/renderer', emptyOutDir: true },
}));
