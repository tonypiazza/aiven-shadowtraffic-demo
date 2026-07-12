import http from 'node:http';
import https from 'node:https';

/**
 * Create an OpenSearch Dashboards reverse proxy that:
 * 1. Injects HTTP Basic authentication
 * 2. Strips framing headers (x-frame-options, frame-ancestors from CSP)
 * 3. Rewrites root-relative redirects to stay under /osd
 */
export function createOsdProxy({ target, username, password }) {
  const targetUrl = new URL(target);
  const protocol = targetUrl.protocol === 'https:' ? https : http;
  const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  return (req, res) => {
    // Build request headers: copy incoming headers, set host and inject auth
    const headers = { ...req.headers };
    headers.host = targetUrl.host;
    headers.authorization = authHeader;

    const proxyReq = protocol.request({
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: req.url,
      method: req.method,
      headers,
    }, (proxyRes) => {
      // Copy status
      res.statusCode = proxyRes.statusCode;

      // Process response headers
      const resHeaders = { ...proxyRes.headers };

      // Strip framing headers
      delete resHeaders['x-frame-options'];

      // Strip frame-ancestors from CSP
      if (resHeaders['content-security-policy']) {
        resHeaders['content-security-policy'] = resHeaders['content-security-policy']
          .replace(/frame-ancestors[^;]*;?/gi, '')
          .trim();
      }

      // Rewrite root-relative redirects, avoiding double-prefixing paths OSD
      // already emits under /osd.
      if (
        resHeaders.location &&
        resHeaders.location.startsWith('/') &&
        !resHeaders.location.startsWith('/osd/') &&
        resHeaders.location !== '/osd'
      ) {
        resHeaders.location = '/osd' + resHeaders.location;
      }

      // Set response headers
      res.writeHead(proxyRes.statusCode, resHeaders);

      // Pipe response body
      proxyRes.pipe(res);

      // If the upstream response stream errors mid-flight, headers are already
      // sent — just tear the socket down rather than double-responding.
      proxyRes.on('error', () => res.destroy());
    });

    // Handle upstream connection errors. Only send 502 if nothing was sent yet.
    proxyReq.on('error', (err) => {
      if (res.headersSent) return res.destroy();
      res.statusCode = 502;
      res.end('Bad Gateway: ' + err.message);
    });

    // Pipe request body to upstream
    req.pipe(proxyReq);
  };
}
