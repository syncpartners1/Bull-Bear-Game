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

const turnTimeouts = new Map(); // gameId -> timeoutId

function clearTurnTimeout(gameId) {
  if (turnTimeouts.has(gameId)) {
    clearTimeout(turnTimeouts.get(gameId));
    turnTimeouts.delete(gameId);
  }
}

function handleTurnTimeout(io, gameId) {
  const state = getGame(gameId);
  if (!state) return;

  const currentPlayerIndex = state.currentPlayerIndex;
  const currentPlayer = state.players[currentPlayerIndex];

  let activeState = state;

  if (!currentPlayer.isAI) {
    const updatedPlayers = state.players.map(p => 
      p.id === currentPlayer.id ? { ...p, isAI: true, profile: 'hunter' } : p
    );
    activeState = { ...state, players: updatedPlayers };
    saveGame(activeState);
    broadcastGameState(io, activeState);
    broadcastToRoom(io, gameId, 'notification', { message: `${currentPlayer.name} ran out of time and is now on Auto-Play!` });

    const turnCards = activeState.turnCards.map(id => activeState._turnCardMap[id]);
    processAITurn(io, activeState, activeState.players[currentPlayerIndex], turnCards);
    return;
  }
  
  // A bot timed out or fallback skip. Skip turn.
  const { finalState, nextTurnCards, gameOver } = advanceTurn(io, activeState);
  saveGame(finalState);
  broadcastGameState(io, finalState);
  broadcastToRoom(io, gameId, 'notification', { message: 'A bot ran out of time! Turn skipped.' });
  if (gameOver) {
    clearTurnTimeout(gameId);
    return;
  }

  const nextPlayer = finalState.players[finalState.currentPlayerIndex];
  scheduleTurnTimeout(io, gameId, finalState.turnEndsAt);
  
  if (nextPlayer.isAI) {
    processAITurn(io, finalState, nextPlayer, nextTurnCards);
  } else {
    io.to(nextPlayer.socketId).emit('turn_started', {
      playerId: nextPlayer.id,
      cards: nextTurnCards,
      turnStep: finalState.turnStep,
    });
  }
}

function scheduleTurnTimeout(io, gameId, turnEndsAt) {
  clearTurnTimeout(gameId);
  if (!turnEndsAt) return;
  const timeoutMs = new Date(turnEndsAt).getTime() - Date.now();
  if (timeoutMs <= 0) {
    handleTurnTimeout(io, gameId);
  } else {
    turnTimeouts.set(gameId, setTimeout(() => handleTurnTimeout(io, gameId), timeoutMs));
  }
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
      clearTurnTimeout(finalState.gameId);
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
      clearTurnTimeout(finalState.gameId);
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
  const delay = 200 + Math.floor(Math.random() * 300); // reduced delay

  setTimeout(() => {
    // Re-fetch in case state changed (disconnect, etc.)
    const fresh = getGame(state.gameId);
    if (!fresh) return;
    const current = fresh.players[fresh.currentPlayerIndex];
    if (current.id !== aiPlayer.id) return; // someone else's turn now

    let decision;
    try {
      if (fresh.remainingActions.length === 3) {
        decision = decideAITurn(fresh, aiPlayer, turnCards);
      } else {
        // Fallback for mid-turn takeover
        decision = { useHostileTakeover: false };
        const availableCards = [...turnCards];
        for (const action of fresh.remainingActions) {
          const c = availableCards.pop();
          if (!c) continue;
          if (action === 'portfolio') decision.portfolioCard = { ...c, sector: c.sector || 'tech' };
          if (action === 'market') { decision.marketCard = { ...c, sector: c.sector || 'tech' }; decision.marketSector = c.sector || 'tech'; decision.marketZone = 'bull'; }
          if (action === 'opponent') { decision.opponentCard = { ...c, sector: c.sector || 'tech' }; }
        }
      }
    } catch (err) {
      console.error(`[AI:${aiPlayer.name}] decideAITurn error:`, err.message);
      return;
    }

    // Resolve a valid opponent target (fallback to first non-self player)
    const opponentTarget =
      decision.targetPlayerId ||
      fresh.players.find((p) => p.id !== aiPlayer.id)?.id;

    let workingState = fresh;
    let activatedAbility = false;

    // ── Step 1: portfolio ────────────────────────────────────────────────────
    if (fresh.remainingActions.includes('portfolio') && decision.portfolioCard) {
      const result = allocateCard(workingState, aiPlayer.id, decision.portfolioCard.id, 'portfolio', {
        pivotSector: decision.portfolioCard.sector,
      });
      if (!result.error) {
        workingState = result.state;
        if (result.activateAbility) activatedAbility = true;
      }
    }

    // ── Step 2: market ───────────────────────────────────────────────────────
    if (fresh.remainingActions.includes('market') && decision.marketCard) {
      const result = allocateCard(workingState, aiPlayer.id, decision.marketCard.id, 'market', {
        sector: decision.marketSector,
        zone:   decision.marketZone,
      });
      if (!result.error) workingState = result.state;
    }

    // ── Step 3: opponent ─────────────────────────────────────────────────────
    if (fresh.remainingActions.includes('opponent') && decision.opponentCard) {
      const result = allocateCard(workingState, aiPlayer.id, decision.opponentCard.id, 'opponent', {
        targetPlayerId: opponentTarget,
        pivotSector: decision.opponentCard.sector,
      });
      if (!result.error) {
        workingState = result.state;
        if (result.activateAbility) activatedAbility = true;
      }
    }

    // ── Hostile Takeover (optional) ──────────────────────────────────────────
    if (activatedAbility && decision.useHostileTakeover && decision.hostileTarget) {
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
    const auth = verifyInitData(telegramInitData);
    if (!auth.valid) {
      emitError(socket, `Authentication failed: ${auth.error}`);
      return;
    }

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

    // Reconnect to an active game (e.g. after page refresh)
    const activeGame = getGame(gameId);
    if (activeGame) {
      const existing = activeGame.players.find(
        (p) => p.telegramId === resolvedTelegramId
      );
      if (!existing) {
        emitError(socket, 'Game already in progress — you are not a registered player');
        return;
      }
      const updatedPlayers = activeGame.players.map((p) =>
        p.id === existing.id ? { ...p, socketId: socket.id, connected: true, isAI: false } : p
      );
      const reconnState = { ...activeGame, players: updatedPlayers };
      saveGame(reconnState);
      socket.join(gameId);
      registerSocket(socket.id, gameId);
      socket.emit('joined_game', { gameId, player: { ...existing, socketId: socket.id } });
      socket.emit('game_state', serializeForPlayer(reconnState, existing.id));
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
    if (totalCount > 4) {
      emitError(socket, 'Maximum 4 players total'); return;
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

    scheduleTurnTimeout(io, gameId, state.turnEndsAt);

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
    if (newState.remainingActions.length > 0) {
      const newTurnEndsAt = new Date(Date.now() + 180000).toISOString();
      newState.turnEndsAt = newTurnEndsAt;
      saveGame(newState);
      broadcastGameState(io, newState);
      socket.emit('card_allocated', { step, cardId, activateAbility: activateAbility || false });
      scheduleTurnTimeout(io, gameId, newTurnEndsAt);
      return;
    }

    // All 3 steps done — advance the turn
    const { finalState, nextTurnCards, gameOver } = advanceTurn(io, newState);
    saveGame(finalState);
    broadcastGameState(io, finalState);
    socket.emit('card_allocated', { step, cardId, activateAbility: activateAbility || false });
    if (gameOver) {
      clearTurnTimeout(gameId);
      return;
    }

    scheduleTurnTimeout(io, gameId, finalState.turnEndsAt);

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
  socket.on('skip_hostile_takeover', ({ gameId }) => {
    const state = getGame(gameId);
    if (!state) { emitError(socket, 'Game not found'); return; }
    socket.emit('hostile_takeover_skipped', { gameId });
  });

  // ── nudge_ai ──────────────────────────────────────────────────────────────
  socket.on('nudge_ai', ({ gameId }) => {
    const state = getGame(gameId);
    if (!state) return;
    const currentPlayer = state.players[state.currentPlayerIndex];
    if (currentPlayer && currentPlayer.isAI) {
      processAITurn(io, state, currentPlayer, state.turnCards.map(id => state._turnCardMap[id]));
    }
  });

  // ── disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const result = handleDisconnect(socket.id);
    if (!result) return;

    if (result.type === 'lobby') {
      broadcastToRoom(io, result.gameId, 'lobby_updated', result.lobby);
    } else if (result.type === 'game') {
      const activeGame = result.state;
      const pIndex = activeGame.players.findIndex((p) => p.socketId === socket.id);
      
      let finalState = activeGame;
      
      if (pIndex !== -1 && !activeGame.players[pIndex].isAI) {
        activeGame.players[pIndex].isAI = true;
        activeGame.players[pIndex].profile = 'hunter';
        saveGame(activeGame);
        finalState = activeGame;

        if (activeGame.currentPlayerIndex === pIndex && activeGame.phase === 'playing') {
          const turnCards = activeGame.turnCards.map(id => activeGame._turnCardMap[id]);
          processAITurn(io, activeGame, activeGame.players[pIndex], turnCards);
        }
      }

      broadcastGameState(io, finalState);
      broadcastToRoom(io, result.gameId, 'player_disconnected', {
        playerId: finalState.players[pIndex]?.id,
      });
    }
  });
}
