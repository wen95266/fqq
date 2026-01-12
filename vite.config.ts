import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  plugins: [react()],
  root: 'fff', // 指定源代码根目录为 fff
  publicDir: false, // 禁用默认的 public 目录查找
  build: {
    outDir: '../dist', // 输出目录设置在项目根目录的 dist 文件夹
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './fff'),
    },
  },
});
