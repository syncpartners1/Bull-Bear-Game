// client/src/context/GameContext.jsx
import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket.js';

const GameContext = createContext(null);

// ─── Reducer ──────────────────────────────────────────────────────────────────

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_PLAYER_INFO':
      return { ...state, myPlayerId: action.playerId, myName: action.name };
    case 'GAME_CREATED':
      return { ...state, gameId: action.gameId, myPlayer: action.player };
    case 'JOINED_GAME':
      return { ...state, gameId: action.gameId, myPlayer: action.player };
    case 'LOBBY_UPDATED':
      return { ...state, lobby: action.lobby };
    case 'GAME_STARTED':
      return { ...state, phase: 'playing' };
    case 'GAME_STATE': {
      const updatedMe = action.gameState?.players?.find(p => p.id === state.myPlayer?.id) || state.myPlayer;
      return { ...state, gameState: action.gameState, myPlayer: updatedMe };
    }
    case 'TURN_STARTED':
      return {
        ...state,
        myTurnCards: action.playerId === state.myPlayer?.id ? action.cards : state.myTurnCards,
        activePlayerId: action.playerId,
        turnStep: action.turnStep,
        pendingAbility: false,
      };
    case 'CARD_ALLOCATED':
      return {
        ...state,
        lastAllocated: action.cardId,
        pendingAbility: action.activateAbility || false,
        myTurnCards: state.myTurnCards.filter((c) => c.id !== action.cardId),
      };
    case 'HOSTILE_TAKEOVER_ACTIVATED':
      return { ...state, pendingAbility: false };
    case 'GAME_OVER':
      return { ...state, finalScores: action.scores, winnerId: action.winnerId, phase: 'finished' };
    case 'ERROR':
      return { ...state, lastError: action.message };
    case 'CLEAR_ERROR':
      return { ...state, lastError: null };
    default:
      return state;
  }
}

const initialState = {
  myPlayer: null,
  myPlayerId: null,
  myName: null,
  gameId: null,
  lobby: null,
  gameState: null,
  myTurnCards: [],
  activePlayerId: null,
  turnStep: null,
  pendingAbility: false,
  finalScores: null,
  winnerId: null,
  phase: 'lobby',
  lastError: null,
};

// ─── Provider ────────────────────────────────────────────────────────────────

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const { socket, connected } = useSocket();

  // Listen to server events
  useEffect(() => {
    if (!socket) return;

    socket.on('game_created',             (data) => dispatch({ type: 'GAME_CREATED', ...data }));
    socket.on('joined_game',              (data) => dispatch({ type: 'JOINED_GAME', ...data }));
    socket.on('lobby_updated',            (lobby) => dispatch({ type: 'LOBBY_UPDATED', lobby }));
    socket.on('game_started',             (data) => dispatch({ type: 'GAME_STARTED', ...data }));
    socket.on('game_state',               (gs)   => dispatch({ type: 'GAME_STATE', gameState: gs }));
    socket.on('turn_started',             (data) => dispatch({ type: 'TURN_STARTED', ...data }));
    socket.on('card_allocated',           (data) => dispatch({ type: 'CARD_ALLOCATED', ...data }));
    socket.on('hostile_takeover_activated',(data) => dispatch({ type: 'HOSTILE_TAKEOVER_ACTIVATED', ...data }));
    socket.on('game_over',                (data) => dispatch({ type: 'GAME_OVER', ...data }));
    socket.on('error',                    (data) => dispatch({ type: 'ERROR', message: data.message }));

    return () => {
      socket.off('game_created');
      socket.off('joined_game');
      socket.off('lobby_updated');
      socket.off('game_started');
      socket.off('game_state');
      socket.off('turn_started');
      socket.off('card_allocated');
      socket.off('hostile_takeover_activated');
      socket.off('game_over');
      socket.off('error');
    };
  }, [socket]);

  // ── Action helpers ─────────────────────────────────────────────────────────

  const createGame = useCallback((telegramId, name) => {
      socket.emit('join_game', {
      telegramId,
      name,
      telegramInitData: window.Telegram?.WebApp?.initData || '',
    });
  }, [socket]);

  const joinGame = useCallback((gameId, telegramId, name) => {
    socket.emit('join_game', {
        gameId,
        telegramId,
        name,
        telegramInitData: window.Telegram?.WebApp?.initData || '',
    });
  }, [socket]);

   const startGame = useCallback((aiCount = 0) => {
    if (!state.gameId) return;
       socket.emit('start_game', { gameId: state.gameId, aiCount });
  }, [socket, state.gameId]);

  const allocateCard = useCallback((cardId, step, extra = {}) => {
    if (!state.gameId) return;
    socket.emit('allocate_card', { gameId: state.gameId, cardId, step, ...extra });
    // Haptic feedback
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
  }, [socket, state.gameId]);

  const activateHostileTakeover = useCallback((target) => {
    if (!state.gameId) return;
    socket.emit('activate_hostile_takeover', { gameId: state.gameId, target });
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('heavy');
  }, [socket, state.gameId]);

  const skipHostileTakeover = useCallback(() => {
    if (!state.gameId) return;
    socket.emit('skip_hostile_takeover', { gameId: state.gameId });
  }, [socket, state.gameId]);

  const clearError = useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);

  const value = {
    ...state,
    connected,
    createGame,
    joinGame,
    startGame,
    allocateCard,
    activateHostileTakeover,
    skipHostileTakeover,
    clearError,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
