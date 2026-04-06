import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerHandlers } from './socketHandlers.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const clientDist = join(__dirname, '../../client/dist');

const app = express();

// In production serve the built React app; in dev allow any origin for Vite
if (isProd && existsSync(clientDist)) {
  app.use(express.static(clientDist));
} else {
  app.use(cors());
}

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// SPA fallback — must come after /health and socket.io routes
if (isProd && existsSync(clientDist)) {
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  registerHandlers(io, socket);
  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Bull & Bear server listening on port ${PORT}`);
});
