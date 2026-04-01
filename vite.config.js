import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sf-proxy',
      configureServer(server) {
        server.middlewares.use('/proxy', (req, res, next) => {
          const targetUrl = req.headers['x-target-url'];
          
          if (!targetUrl) {
            return next();
          }

          let body = [];
          req.on('data', chunk => body.push(chunk));
          req.on('end', () => {
            body = Buffer.concat(body);

            const targetURLObj = new URL(targetUrl);
            const options = {
              method: req.method,
              headers: { ...req.headers, host: targetURLObj.host }
            };

            // Remove headers that cause problems or reveal the proxy
            delete options.headers['x-target-url'];
            delete options.headers['origin'];
            delete options.headers['referer'];
            delete options.headers['accept-encoding'];

            const clientReq = https.request(targetUrl, options, (clientRes) => {
              // Pass headers back, excluding CORS headers
              const resHeaders = { ...clientRes.headers };
              delete resHeaders['access-control-allow-origin'];
              delete resHeaders['access-control-allow-credentials'];
              delete resHeaders['access-control-allow-methods'];
              delete resHeaders['access-control-allow-headers'];
              
              res.writeHead(clientRes.statusCode, resHeaders);
              clientRes.pipe(res);
            });

            clientReq.on('error', (e) => {
              res.statusCode = 500;
              res.end(e.message);
            });

            if (body.length > 0) {
              clientReq.write(body);
            }
            clientReq.end();
          });
        });
      }
    }
  ],
  server: {
    port: 8000,
    strictPort: true
  }
})
