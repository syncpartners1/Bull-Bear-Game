// server/src/socketHandlers.js
import { v4 as uuidv4 } from 'uuid';
import {
  createInitialState,
  startTurn,
  allocateCard,
  activateHostileTakeover,
  endTurn,
  revealInsiderTrading,
  calculateScores,
  serializeForPlayer,
} from './gameEngine.js';
import {
  createLobby,
  joinLobby,
  getLobby,
  deleteLobby,
  saveGame,
  getGame,
  registerSocket,
  handleDisconnect,
} from './gameState.js';
import { verifyInitData } from './telegramAuth.js';

// ─── Broadcast helpers ────────────────────────────────────────────────────────

function broadcastGameState(io, state) {
  state.players.forEach((p) => {
    if (p.socketId && p.connected !== false) {
      io.to(p.socketId).emit('game_state', serializeForPlayer(state, p.id));
    }
  });
}

function broadcastToRoom(io, gameId, event, payload) {
  io.to(gameId).emit(event, payload);
}

function emitError(socket, message) {
  socket.emit('error', { message });
}

// ─── Handler registration ─────────────────────────────────────────────────────

export function registerHandlers(io, socket) {

  // ── join_game ─────────────────────────────────────────────────────────────
  // Payload: { gameId?: string, telegramInitData: string, name: string, telegramId: string }
  // Omit gameId to create a new lobby; include it to join an existing one.
  socket.on('join_game', ({ gameId, telegramInitData, name, telegramId }) => {
    // Verify the request came from a real Telegram client
    const auth = verifyInitData(telegramInitData);
    if (!auth.valid) {
      emitError(socket, `Authentication failed: ${auth.error}`);
      return;
    }

    // Prefer verified identity from initData; fall back to client-supplied values
    const verifiedUser = auth.data?.user;
    const resolvedTelegramId = String(verifiedUser?.id ?? telegramId ?? socket.id);
    const resolvedName = verifiedUser
      ? (verifiedUser.first_name + (verifiedUser.last_name ? ` ${verifiedUser.last_name}` : ''))
      : (name || 'Player');

    const player = {
      id:         uuidv4(),
      telegramId: resolvedTelegramId,
      name:       resolvedName,
      socketId:   socket.id,
      portfolio:  [],
      score:      0,
      missions:   [],
      connected:  true,
    };

    if (!gameId) {
      // Create new lobby
      const newGameId = uuidv4();
      createLobby(newGameId, player);
      socket.join(newGameId);
      registerSocket(socket.id, newGameId);
      socket.emit('game_created', { gameId: newGameId, player });
      broadcastToRoom(io, newGameId, 'lobby_updated', getLobby(newGameId));
      return;
    }

    // Join existing lobby
    const { lobby, error } = joinLobby(gameId, player);
    if (error) { emitError(socket, error); return; }

    socket.join(gameId);
    registerSocket(socket.id, gameId);
    socket.emit('joined_game', { gameId, player });
    broadcastToRoom(io, gameId, 'lobby_updated', lobby);
  });

  // ── start_game ────────────────────────────────────────────────────────────
  // Payload: { gameId: string }
  socket.on('start_game', ({ gameId }) => {
    const lobby = getLobby(gameId);
    if (!lobby) { emitError(socket, 'Lobby not found'); return; }

    const requesting = lobby.players.find((p) => p.socketId === socket.id);
    if (!requesting || requesting.id !== lobby.hostId) {
      emitError(socket, 'Only the host can start the game'); return;
    }
    if (lobby.players.length < 2) {
      emitError(socket, 'Need at least 2 players to start'); return;
    }

    let state = createInitialState(gameId, lobby.players);
    const { state: stateAfterDraw, drawnCards } = startTurn(state);
    state = stateAfterDraw;

    saveGame(state);
    lobby.players.forEach((p) => registerSocket(p.socketId, gameId));
    deleteLobby(gameId);

    broadcastToRoom(io, gameId, 'game_started', { gameId });
    broadcastGameState(io, state);

    const currentPlayer = state.players[state.currentPlayerIndex];
    io.to(currentPlayer.socketId).emit('turn_started', {
      playerId: currentPlayer.id,
      cards: drawnCards,
      turnStep: state.turnStep,
    });
  });

  // ── allocate_card ─────────────────────────────────────────────────────────
  // Payload: { gameId, cardId, step: 'portfolio'|'market'|'opponent',
  //            sector?, zone?, targetPlayerId? }
  socket.on('allocate_card', ({ gameId, cardId, step, sector, zone, targetPlayerId }) => {
    const state = getGame(gameId);
    if (!state) { emitError(socket, 'Game not found'); return; }

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player) { emitError(socket, 'Player not in this game'); return; }

    const { state: newState, error, activateAbility } = allocateCard(
      state, player.id, cardId, step, { sector, zone, targetPlayerId }
    );
    if (error) { emitError(socket, error); return; }

    // If all 3 allocation steps complete, advance the turn
    let finalState = newState;
    let nextTurnCards = [];

    if (newState.turnStep === 'end_turn') {
      finalState = endTurn(newState);

      if (finalState.phase === 'reveal') {
        // Deck exhausted → reveal insider trading
        finalState = revealInsiderTrading(finalState);
        broadcastGameState(io, finalState);
        saveGame(finalState);

        // Give clients a moment then trigger scoring
        setTimeout(() => {
          const scored = calculateScores(finalState);
          saveGame(scored);
          broadcastGameState(io, scored);
          broadcastToRoom(io, gameId, 'game_over', {
            scores: scored.scores,
            winnerId: scored.winnerId,
          });
        }, 3000);
        return;
      }

      // Start next player's turn
      const drawResult = startTurn(finalState);
      finalState = drawResult.state;
      nextTurnCards = drawResult.drawnCards;

      if (finalState.phase === 'reveal') {
        // Deck ran out during startTurn
        finalState = revealInsiderTrading(finalState);
        saveGame(finalState);
        broadcastGameState(io, finalState);
        setTimeout(() => {
          const scored = calculateScores(finalState);
          saveGame(scored);
          broadcastGameState(io, scored);
          broadcastToRoom(io, gameId, 'game_over', {
            scores: scored.scores,
            winnerId: scored.winnerId,
          });
        }, 3000);
        return;
      }
    }

    saveGame(finalState);
    broadcastGameState(io, finalState);
    socket.emit('card_allocated', { step, cardId, activateAbility: activateAbility || false });

    // Notify current player to take their turn if we advanced
    if (newState.turnStep === 'end_turn' && nextTurnCards.length > 0) {
      const nextPlayer = finalState.players[finalState.currentPlayerIndex];
      io.to(nextPlayer.socketId).emit('turn_started', {
        playerId: nextPlayer.id,
        cards: nextTurnCards,
        turnStep: finalState.turnStep,
      });
    }
  });

  // ── activate_hostile_takeover ─────────────────────────────────────────────
  // Payload: { gameId, target: { location: 'portfolio'|'market', cardId,
  //            playerId?, sector?, zone? } }
  socket.on('activate_hostile_takeover', ({ gameId, target }) => {
    const state = getGame(gameId);
    if (!state) { emitError(socket, 'Game not found'); return; }

    const player = state.players.find((p) => p.socketId === socket.id);
    if (!player) { emitError(socket, 'Player not in this game'); return; }

    const { state: newState, error, removedCard } = activateHostileTakeover(state, player.id, target);
    if (error) { emitError(socket, error); return; }

  // Build AI player objects — each gets a distinct personality profile
    const AI_PROFILES = ['hunter', 'jess', 'mandy', 'ruth'];
    const aiPlayers = Array.from({ length: Math.max(0, Number(aiCount)) }, (_, i) => {
      const profile = AI_PROFILES[i % AI_PROFILES.length];
      return {
        id:         uuidv4(),
        telegramId: `ai_${i + 1}`,
        name:       profile.charAt(0).toUpperCase() + profile.slice(1), // "Hunter", "Jess", …
        profile,
        socketId:   null,
        portfolio:  [],
        score:      0,
        missions:   [],
        connected:  true,
        isAI:       true,
      };
    });

    saveGame(newState);
    broadcastGameState(io, newState);
    broadcastToRoom(io, gameId, 'hostile_takeover_activated', {
      activatedBy: player.id,
      removedCard,
    });
  });

  // ── skip_hostile_takeover ─────────────────────────────────────────────────
  // Player chose not to use the hostile takeover ability this turn.
  socket.on('skip_hostile_takeover', ({ gameId }) => {
    const state = getGame(gameId);
    if (!state) { emitError(socket, 'Game not found'); return; }
    // No state change needed — just acknowledge
    socket.emit('hostile_takeover_skipped', { gameId });
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const result = handleDisconnect(socket.id);
    if (!result) return;

    if (result.type === 'lobby') {
      broadcastToRoom(io, result.gameId, 'lobby_updated', result.lobby);
    } else if (result.type === 'game') {
      broadcastGameState(io, result.state);
      broadcastToRoom(io, result.gameId, 'player_disconnected', {
        playerId: result.state.players.find((p) => p.socketId === socket.id)?.id,
      });
    }
  });
}
