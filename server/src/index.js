import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerHandlers } from './socketHandlers.js';
import { setupBot, handleUpdate } from './bot.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const clientDist = join(__dirname, '../../client/dist');
const APP_URL    = process.env.APP_URL || 'https://bull-and-bear.up.railway.app';
const BOT_TOKEN  = process.env.TELEGRAM_BOT_TOKEN;
const isProd     = process.env.NODE_ENV === 'production';

const hasClient  = existsSync(clientDist);
console.log(`[server] NODE_ENV=${process.env.NODE_ENV} hasClient=${hasClient} clientDist=${clientDist}`);

const app = express();

// CORS always on (needed for Socket.io handshake and local dev)
app.use(cors());
app.use(express.json());

// Serve built React app when present (production build)
if (hasClient) {
  app.use(express.static(clientDist));
}

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Telegram webhook — token in path prevents spoofing
if (BOT_TOKEN) {
  app.post(`/webhook/${BOT_TOKEN}`, handleUpdate);
}

// SPA fallback — must be last so API routes take priority
if (hasClient) {
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  registerHandlers(io, socket);
  socket.on('disconnect', () => console.log(`[socket] disconnected: ${socket.id}`));
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, async () => {
  console.log(`Bull & Bear server listening on port ${PORT}`);
  if (isProd && BOT_TOKEN) {
    const webhookUrl = `${APP_URL}/webhook/${BOT_TOKEN}`;
    await setupBot(webhookUrl);
  }
});
