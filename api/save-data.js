// Simple dev server API to save data
// This runs during npm run dev only

import fs from 'fs';
import path from 'path';

export default function saveDataPlugin() {
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
