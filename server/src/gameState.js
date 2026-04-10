// server/src/gameState.js
// In-memory state store for active games and lobbies.

const games = new Map();       // gameId → GameState
const lobbies = new Map();     // gameId → LobbyState
const socketToGame = new Map(); // socketId → gameId

// ─── Lobby management ─────────────────────────────────────────────────────────

export function createLobby(gameId, hostPlayer) {
  lobbies.set(gameId, {
    gameId,
    hostId: hostPlayer.id,
    players: [hostPlayer],
    createdAt: new Date().toISOString(),
  });
  return gameId;
}

export function joinLobby(gameId, player) {
  const lobby = lobbies.get(gameId);
  if (!lobby) return { error: 'Game not found' };
  
  // Handle re-entry: if player with same telegramId exists, update their socketId and return success
  const existingIndex = lobby.players.findIndex((p) => p.telegramId === player.telegramId);
  if (existingIndex !== -1) {
    lobby.players[existingIndex].socketId = player.socketId;
    return { lobby };
  }

  if (lobby.players.length >= 4) return { error: 'Game is full (max 4 players)' };
  
  lobby.players.push(player);
  return { lobby };
}

export function leaveLobby(gameId, socketId) {
  const lobby = lobbies.get(gameId);
  if (!lobby) return null;
  
  const playerLeaving = lobby.players.find((p) => p.socketId === socketId);
  if (!playerLeaving) return lobby;

  lobby.players = lobby.players.filter((p) => p.socketId !== socketId);
  
  // If the host left, migrate hostId to the next player
  if (lobby.hostId === playerLeaving.id && lobby.players.length > 0) {
    lobby.hostId = lobby.players[0].id;
  }

  if (lobby.players.length === 0) lobbies.delete(gameId);
  return lobby;
}

export function getLobby(gameId) {
  return lobbies.get(gameId) || null;
}

export function deleteLobby(gameId) {
  lobbies.delete(gameId);
}

// ─── Game state management ────────────────────────────────────────────────────

export function saveGame(gameState) {
  games.set(gameState.gameId, gameState);
}

export function getGame(gameId) {
  return games.get(gameId) || null;
}

export function deleteGame(gameId) {
  const state = games.get(gameId);
  if (state) {
    state.players.forEach((p) => socketToGame.delete(p.socketId));
  }
  games.delete(gameId);
}

// ─── Socket ↔ game index ──────────────────────────────────────────────────────

export function registerSocket(socketId, gameId) {
  socketToGame.set(socketId, gameId);
}

export function unregisterSocket(socketId) {
  socketToGame.delete(socketId);
}

export function getGameIdBySocket(socketId) {
  return socketToGame.get(socketId) || null;
}

// ─── Disconnect handling ──────────────────────────────────────────────────────

/**
 * Called on socket disconnect.
 * Returns { type: 'lobby'|'game', gameId, lobby?|state? } or null.
 */
export function handleDisconnect(socketId) {
  // Check active games first
  const gameId = getGameIdBySocket(socketId);
  if (gameId) {
    unregisterSocket(socketId);
    const state = getGame(gameId);
    if (!state) return null;
    const players = state.players.map((p) =>
      p.socketId === socketId ? { ...p, connected: false } : p
    );
    const newState = { ...state, players };
    saveGame(newState);
    return { type: 'game', gameId, state: newState };
  }

  // Check lobbies
  for (const [gid] of lobbies) {
    const lobby = lobbies.get(gid);
    if (lobby && lobby.players.some((p) => p.socketId === socketId)) {
      const updatedLobby = leaveLobby(gid, socketId);
      return { type: 'lobby', gameId: gid, lobby: updatedLobby };
    }
  }

  return null;
}
