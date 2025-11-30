// apps/merchant/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@repo/ui': path.resolve(__dirname, '../packages/ui'), // ✅ 关键！
    },
  },
});