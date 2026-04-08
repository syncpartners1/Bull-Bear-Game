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
import { decideAITurn } from './aiPlayer.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
/** Generate a unique 7-digit numeric game ID. */
function generateGameId() {
  let id;
  do {
    id = String(Math.floor(1000000 + Math.random() * 9000000));
  } while (getLobby(id) || getGame(id));
  return id;
}
 
/**
 * Called after the 3rd card allocation (turnStep === 'end_turn').
 * Runs endTurn, startTurn, and handles the reveal/scoring phase.
 * Returns { finalState, nextTurnCards, gameOver }.
 */
function advanceTurn(io, state) {
  let finalState = endTurn(state);
 
  if (finalState.phase === 'reveal') {
    finalState = revealInsiderTrading(finalState);
    saveGame(finalState);
    broadcastGameState(io, finalState);
    setTimeout(() => {
      const scored = calculateScores(finalState);
      saveGame(scored);
      broadcastGameState(io, scored);
      broadcastToRoom(io, finalState.gameId, 'game_over', {
        scores: scored.scores,
        winnerId: scored.winnerId,
      });
    }, 3000);
    return { finalState, nextTurnCards: [], gameOver: true };
  }
 
  const drawResult = startTurn(finalState);
  finalState = drawResult.state;
  const nextTurnCards = drawResult.drawnCards;
 
  if (finalState.phase === 'reveal') {
    finalState = revealInsiderTrading(finalState);
    saveGame(finalState);
    broadcastGameState(io, finalState);
    setTimeout(() => {
      const scored = calculateScores(finalState);
      saveGame(scored);
      broadcastGameState(io, scored);
      broadcastToRoom(io, finalState.gameId, 'game_over', {
        scores: scored.scores,
        winnerId: scored.winnerId,
      });
    }, 3000);
    return { finalState, nextTurnCards: [], gameOver: true };
  }
 
  return { finalState, nextTurnCards, gameOver: false };
}
 
/**
 * Execute an AI player's full turn (all 3 allocations + optional hostile takeover).
 * Delays execution slightly so clients see smooth progression.
 */
function processAITurn(io, state, aiPlayer, turnCards) {
  const delay = 900 + Math.floor(Math.random() * 600); // 0.9–1.5 s
 
  setTimeout(() => {
    // Re-fetch in case state changed (disconnect, etc.)
    const fresh = getGame(state.gameId);
    if (!fresh) return;
    const current = fresh.players[fresh.currentPlayerIndex];
    if (current.id !== aiPlayer.id) return; // someone else's turn now
 
    let decision;
    try {
      decision = decideAITurn(fresh, aiPlayer, turnCards);
    } catch (err) {
      console.error(`[AI:${aiPlayer.name}] decideAITurn error:`, err.message);
      return;
    }
 
    // Resolve a valid opponent target (fallback to first non-self player)
    const opponentTarget =
      decision.targetPlayerId ||
      fresh.players.find((p) => p.id !== aiPlayer.id)?.id;
 
    // ── Step 1: portfolio ────────────────────────────────────────────────────
    const r1 = allocateCard(fresh, aiPlayer.id, decision.portfolioCard.id, 'portfolio', {
      pivotSector: decision.portfolioCard.sector,
    });
    if (r1.error) { console.error(`[AI:${aiPlayer.name}] portfolio:`, r1.error); return; }
 
    // ── Step 2: market ───────────────────────────────────────────────────────
    const r2 = allocateCard(r1.state, aiPlayer.id, decision.marketCard.id, 'market', {
      sector: decision.marketSector,
      zone:   decision.marketZone,
    });
    if (r2.error) { console.error(`[AI:${aiPlayer.name}] market:`, r2.error); return; }
 
    // ── Step 3: opponent ─────────────────────────────────────────────────────
    const r3 = allocateCard(r2.state, aiPlayer.id, decision.opponentCard.id, 'opponent', {
      targetPlayerId: opponentTarget,
      pivotSector: decision.opponentCard.sector,
    });
    if (r3.error) { console.error(`[AI:${aiPlayer.name}] opponent:`, r3.error); return; }
 
    let workingState = r3.state;
 
    // ── Hostile Takeover (optional) ──────────────────────────────────────────
    if ((r1.activateAbility || r3.activateAbility) && decision.useHostileTakeover && decision.hostileTarget) {
      const ht = activateHostileTakeover(workingState, aiPlayer.id, decision.hostileTarget);
      if (!ht.error) {
        workingState = ht.state;
        broadcastToRoom(io, workingState.gameId, 'hostile_takeover_activated', {
          activatedBy: aiPlayer.id,
          removedCard: ht.removedCard,
        });
      }
    }
 
    // ── Advance turn ─────────────────────────────────────────────────────────
    const { finalState, nextTurnCards, gameOver } = advanceTurn(io, workingState);
    saveGame(finalState);
    broadcastGameState(io, finalState);
    if (gameOver) return;
 
    // ── Notify next player ───────────────────────────────────────────────────
    const nextPlayer = finalState.players[finalState.currentPlayerIndex];
    if (nextPlayer.isAI) {
      processAITurn(io, finalState, nextPlayer, nextTurnCards);
    } else {
      io.to(nextPlayer.socketId).emit('turn_started', {
        playerId:  nextPlayer.id,
        cards:     nextTurnCards,
        turnStep:  finalState.turnStep,
      });
    }
  }, delay);
}
 
// ─── Handler registration ─────────────────────────────────────────────────────

export function registerHandlers(io, socket) {

  // ── join_game ─────────────────────────────────────────────────────────────
  // Payload: { gameId?: string, telegramInitData?: string, name: string, telegramId: string }
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
      // Create new lobby with a 7-digit game ID
      const newGameId = generateGameId();
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
  // Payload: { gameId: string, aiCount?: number }
  socket.on('start_game', ({ gameId, aiCount = 0 }) => {
    const lobby = getLobby(gameId);
    if (!lobby) { emitError(socket, 'Lobby not found'); return; }

    const requesting = lobby.players.find((p) => p.socketId === socket.id);
    if (!requesting || requesting.id !== lobby.hostId) {
      emitError(socket, 'Only the host can start the game'); return;
    }

    const numAI      = Math.max(0, Math.min(4, Number(aiCount) || 0));
    const totalCount = lobby.players.length + numAI;

    if (totalCount < 2) {
      emitError(socket, 'Need at least 2 players total (human + AI)'); return;
    }
    if (totalCount > 5) {
      emitError(socket, 'Maximum 5 players total'); return;
    }

    // Build AI player objects
    const AI_PROFILES = ['hunter', 'jess', 'mandy', 'ruth'];
    const AI_NAMES    = ['Hunter', 'Jess', 'Mandy', 'Ruth'];
    const aiPlayers   = Array.from({ length: numAI }, (_, i) => ({
      id:         uuidv4(),
      telegramId: `ai_${i + 1}`,
      name:       AI_NAMES[i % AI_NAMES.length],
      profile:    AI_PROFILES[i % AI_PROFILES.length],
      socketId:   null,
      portfolio:  [],
      score:      0,
      missions:   [],
      connected:  true,
      isAI:       true,
    }));
 
    const allPlayers = [...lobby.players, ...aiPlayers];
 
    let state = createInitialState(gameId, allPlayers);
    const { state: stateAfterDraw, drawnCards } = startTurn(state);
    state = stateAfterDraw;

    saveGame(state);
    lobby.players.forEach((p) => registerSocket(p.socketId, gameId));
    deleteLobby(gameId);

    broadcastToRoom(io, gameId, 'game_started', { gameId });
    broadcastGameState(io, state);

    const firstPlayer = state.players[state.currentPlayerIndex];
    if (firstPlayer.isAI) {
      // AI goes first — kick off its turn automatically
      processAITurn(io, state, firstPlayer, drawnCards);
    } else {
      io.to(firstPlayer.socketId).emit('turn_started', {
        playerId: firstPlayer.id,
        cards:    drawnCards,
        turnStep: state.turnStep,
      });
    }
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

    // Still mid-turn — just save and broadcast
    if (newState.turnStep !== 'end_turn') {
      saveGame(newState);
      broadcastGameState(io, newState);
      socket.emit('card_allocated', { step, cardId, activateAbility: activateAbility || false });
      return;
    }

    // If all 3 allocation steps complete, advance the turn
    const { finalState, nextTurnCards, gameOver } = advanceTurn(io, newState);
    if (gameOver) {
      saveGame(finalState);
      broadcastGameState(io, finalState);
      socket.emit('card_allocated', { step, cardId, activateAbility: activateAbility || false });
      return;
    }

    // Start next player's turn
    saveGame(finalState);
    broadcastGameState(io, finalState);
    socket.emit('card_allocated', { step, cardId, activateAbility: activateAbility || false });

    const nextPlayer = finalState.players[finalState.currentPlayerIndex];
    if (nextPlayer.isAI) {
      processAITurn(io, finalState, nextPlayer, nextTurnCards);
    } else {
      io.to(nextPlayer.socketId).emit('turn_started', {
        playerId: nextPlayer.id,
        cards:    nextTurnCards,
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
