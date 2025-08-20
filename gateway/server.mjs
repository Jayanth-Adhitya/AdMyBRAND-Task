import fs from 'fs';
import path from 'path';
import url from 'url';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import http from 'http';
import QRCode from 'qrcode';
import { WebSocketServer } from 'ws';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const app = express();
const server = app.listen(process.env.PORT || 3000, () => console.log('Gateway on http://localhost:'+ (process.env.PORT||3000)));

console.log(`[Gateway] PUBLIC_BASE_URL: ${process.env.PUBLIC_BASE_URL}`);

const MODE = process.env.MODE || 'wasm';
// For local development, always use localhost for the backend
const DEV_BACKEND_URL = 'http://localhost:8000'; 
// For Dockerized environment, use the service name
const BACKEND_URL = 'http://server:8000';

// Register /infer proxy route BEFORE static and catch-all handlers
app.use('/infer', (req, res) => {
  console.log(`[Gateway] /infer route handler activated for ${req.method} ${req.url}`);

  const target = process.env.NODE_ENV === 'development' ? DEV_BACKEND_URL : BACKEND_URL;
  const { hostname, port, pathname } = new URL(target);

  const options = {
    hostname,
    port,
    path: '/infer',
    method: req.method,
    headers: {
      ...req.headers,
      host: hostname, // Set host to the target's host
    },
  };

  console.log(`[Gateway] Manual proxying to: ${hostname}:${port}/infer`);
  console.log('[Gateway] Proxy Request Options:', options);

  const proxyReq = http.request(options, (proxyRes) => {
    console.log(`[Gateway] Backend response status: ${proxyRes.statusCode}`);
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error('[Gateway] Manual proxy error:', err.message);
    res.status(502).json({ error: 'Proxy error', detail: err.message });
  });

  req.on('data', (chunk) => {
    console.log(`[Gateway] Request data chunk received: ${chunk.length} bytes`);
  });
  req.on('end', () => {
    console.log('[Gateway] Request data stream ended.');
  });

  req.pipe(proxyReq, { end: true });
  console.log('[Gateway] Request piped to proxyReq.');
});

const metricsPath = path.join(__dirname, '..', 'metrics.json');
app.post('/metrics/report', bodyParser.json(), (req, res) => { // Apply bodyParser.json directly to this route
  fs.writeFileSync(metricsPath, JSON.stringify(req.body, null, 2));
  res.json({ok:true});
});
app.get('/metrics.json', (req, res) => {
  if (fs.existsSync(metricsPath)) res.sendFile(metricsPath);
  else res.json({});
});

app.get('/bench/start', (req, res) => {
  const { room = 'default', duration = '30', mode = MODE } = req.query;
  const msg = JSON.stringify({ type: 'bench:start', room, duration: Number(duration), mode });
  for (const client of wss.clients) { try { client.send(msg); } catch {} }
  res.json({ok:true});
});

app.get('/qr', async (req, res) => {
  const room = String(req.query.room || 'demo');
  const mode = String(req.query.mode || MODE);
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${base}/?role=publisher&room=${encodeURIComponent(room)}&mode=${encodeURIComponent(mode)}`;
  try {
    const png = await QRCode.toBuffer(url, { width: 164, margin: 0 });
    res.setHeader('Content-Type', 'image/png');
    res.send(png);
  } catch (e) { res.status(500).send('QR error'); }
});

const pubDir = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(pubDir, {
  setHeaders: (res, p) => { if (p.endsWith('.wasm')) res.setHeader('Content-Type', 'application/wasm'); }
}));
app.use((req, res) => { res.sendFile(path.join(pubDir, 'index.html')); });

const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map();
wss.on('connection', (ws, req) => {
  const qp = new URL(req.url, 'http://localhost').searchParams;
  const room = qp.get('room') || 'default';
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  ws.on('message', (buf) => {
    let m; try { m = JSON.parse(buf.toString()); } catch { return; }
    for (const peer of rooms.get(room) || []) { if (peer !== ws && peer.readyState === 1) { try { peer.send(JSON.stringify(m)); } catch {} } }
  });
  ws.on('close', () => { rooms.get(room)?.delete(ws); });
});
