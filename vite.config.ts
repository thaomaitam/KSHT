import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Plugin to save data during dev
function saveDataPlugin() {
  return {
    name: 'save-data-api',
    configureServer(server) {
      server.middlewares.use('/api/save-data', async (req, res) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              const filePath = path.resolve(process.cwd(), 'public/data.json');
              fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: error.message }));
            }
          });
        } else {
          res.writeHead(405);
          res.end('Method not allowed');
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // For GitHub Pages with custom domain (giaban.khosihuythao.com), use './'
    // If no custom domain, use '/Giban-01/' (your repo name)
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), saveDataPlugin()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
