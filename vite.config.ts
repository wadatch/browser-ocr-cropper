import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const repoName = 'browser-ocr-cropper';

function injectGoogleSiteVerification(token: string | undefined): Plugin {
  return {
    name: 'inject-google-site-verification',
    transformIndexHtml(html) {
      if (!token) return html;
      const tag = `<meta name="google-site-verification" content="${token}" />`;
      return html.replace('</head>', `    ${tag}\n  </head>`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [
      react(),
      injectGoogleSiteVerification(env.VITE_GOOGLE_SITE_VERIFICATION),
    ],
    base: command === 'build' ? `/${repoName}/` : '/',
    worker: { format: 'es' },
  };
});
