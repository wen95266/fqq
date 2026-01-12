import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 自定义插件：构建后复制 _worker.js 到 dist
const copyWorkerPlugin = () => ({
  name: 'copy-worker',
  closeBundle() {
    try {
      const workerSrc = path.resolve(__dirname, 'functions/_worker.js');
      const distDir = path.resolve(__dirname, 'dist');
      const workerDest = path.join(distDir, '_worker.js');

      if (fs.existsSync(workerSrc)) {
        if (!fs.existsSync(distDir)) {
          fs.mkdirSync(distDir, { recursive: true });
        }
        fs.copyFileSync(workerSrc, workerDest);
        console.log(`[Vite] Copied _worker.js to ${workerDest}`);
      } else {
        console.warn(`[Vite] Warning: functions/_worker.js not found at ${workerSrc}`);
      }
    } catch (e) {
      console.error('[Vite] Error copying _worker.js:', e);
    }
  }
});

export default defineConfig({
  plugins: [react(), copyWorkerPlugin()],
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
