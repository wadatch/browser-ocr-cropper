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

function injectGoogleAnalytics(measurementId: string | undefined): Plugin {
  return {
    name: 'inject-google-analytics',
    transformIndexHtml(html) {
      if (!measurementId) return html;
      // Guard against HTML/JS injection via env var; GA IDs look like G-XXXXXXXXXX.
      if (!/^[A-Za-z0-9-]+$/.test(measurementId)) {
        throw new Error(
          `Invalid VITE_GA_MEASUREMENT_ID: ${JSON.stringify(measurementId)}`,
        );
      }
      const snippet = `    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=${measurementId}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId}');
    </script>
`;
      return html.replace('</head>', `${snippet}  </head>`);
    },
  };
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [
      react(),
      injectGoogleSiteVerification(env.VITE_GOOGLE_SITE_VERIFICATION),
      injectGoogleAnalytics(env.VITE_GA_MEASUREMENT_ID),
    ],
    base: command === 'build' ? `/${repoName}/` : '/',
    worker: { format: 'es' },
  };
});
