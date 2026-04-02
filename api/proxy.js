import https from 'https';

/**
 * Vercel Serverless Function Proxy for Salesforce APIs
 * Replicates the logic from vite.config.js for production deployment.
 */
export default function handler(req, res) {
  const targetUrl = req.headers['x-target-url'];

  if (!targetUrl) {
    return res.status(400).send('Missing x-target-url header');
  }

  // Parse target URL
  const targetURLObj = new URL(targetUrl);
  
  // Clone and sanitize headers
  const headers = { ...req.headers, host: targetURLObj.host };
  delete headers['x-target-url'];
  delete headers['origin'];
  delete headers['referer'];
  delete headers['accept-encoding'];
  // Vercel-specific headers to remove
  delete headers['x-vercel-id'];
  delete headers['x-forwarded-for'];
  delete headers['x-real-ip'];

  const options = {
    method: req.method,
    headers: headers
  };

  const clientReq = https.request(targetUrl, options, (clientRes) => {
    // Collect response headers, excluding CORS ones
    const resHeaders = { ...clientRes.headers };
    delete resHeaders['access-control-allow-origin'];
    delete resHeaders['access-control-allow-credentials'];
    delete resHeaders['access-control-allow-methods'];
    delete resHeaders['access-control-allow-headers'];
    
    // Set headers and status
    res.writeHead(clientRes.statusCode, resHeaders);
    
    // Pipe response from Salesforce back to the browser
    clientRes.pipe(res);
  });

  clientReq.on('error', (e) => {
    console.error('Proxy error:', e.message);
    res.status(500).send(e.message);
  });

  // Pipe raw request from the browser directly into the Salesforce request
  req.pipe(clientReq);
}

// CRITICAL: Disable Vercel's body parser to allow raw stream piping
export const config = {
  api: {
    bodyParser: false,
  },
};
