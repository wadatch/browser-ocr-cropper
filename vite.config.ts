import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = 'browser-ocr-cropper';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? `/${repoName}/` : '/',
  worker: { format: 'es' },
}));
