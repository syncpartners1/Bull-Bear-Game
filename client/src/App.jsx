// client/src/App.jsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext.jsx';
import Board from './components/Board.jsx';
import ScoreBoard from './components/ScoreBoard.jsx';

// ─── Telegram bootstrap ───────────────────────────────────────────────────────

function getTelegramUser() {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      return {
        telegramId: String(u.id),
        name: u.first_name + (u.last_name ? ` ${u.last_name}` : '') || u.username || 'Player',
      };
    }
  } catch (_) {}
  // Fallback for browser testing
  const id = sessionStorage.getItem('devId') || String(Math.floor(Math.random() * 9000) + 1000);
  sessionStorage.setItem('devId', id);
  return { telegramId: id, name: `Player_${id.slice(-3)}` };
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      // Apply Telegram theme
      if (tg.themeParams?.bg_color) {
        document.documentElement.style.setProperty('--tg-bg-color', tg.themeParams.bg_color);
      }
      if (tg.themeParams?.button_color) {
        document.documentElement.style.setProperty('--tg-button-color', tg.themeParams.button_color);
      }
    }
  }, []);

  return (
    <BrowserRouter>
      <GameProvider>
        <div className="h-screen flex flex-col overflow-hidden bg-gray-950 text-white">
          <AppRoutes />
        </div>
      </GameProvider>
    </BrowserRouter>
  );
}

function AppRoutes() {
  const { phase, finalScores } = useGame();

  if (finalScores) return <ScoreBoard />;

  return (
    <Routes>
      <Route path="/" element={<LobbyPage />} />
      <Route path="/game/:gameId" element={<GamePage />} />
    </Routes>
  );
}

// ─── Lobby page ───────────────────────────────────────────────────────────────

function LobbyPage() {
  const { telegramId, name } = getTelegramUser();
  const { createGame, joinGame, startGame, lobby, myPlayer, gameId, connected, lastError, clearError } = useGame();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState('');

  // When game starts, navigate to game view
  useEffect(() => {
    if (gameId && lobby === null) {
      navigate(`/game/${gameId}`);
    }
  }, [gameId, lobby, navigate]);

  function handleCreate() {
    createGame(telegramId, name);
  }

  function handleJoin() {
    const code = joinCode.trim();
    if (!code) return;
    joinGame(code, telegramId, name);
    navigate(`/game/${code}`);
  }

  const isHost = lobby?.hostId === myPlayer?.id;

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Bull <span className="text-green-400">↑</span> Bear <span className="text-red-400">↓</span></h1>
        <p className="text-gray-400 text-sm mt-1">Multiplayer Financial Strategy</p>
        <div className={`mt-2 text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
          {connected ? '● Connected' : '○ Connecting…'}
        </div>
      </div>

      {lastError && (
        <div className="bg-red-900/50 border border-red-600 rounded-lg p-3 text-sm text-red-300 w-full max-w-xs flex items-center justify-between">
          <span>{lastError}</span>
          <button onClick={clearError} className="ml-2 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {!lobby ? (
        // Pre-lobby: create or join
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={handleCreate}
            disabled={!connected}
            className="rounded-xl py-3 bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 disabled:opacity-50 transition-colors"
          >
            Create New Game
          </button>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Game ID"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1 rounded-xl bg-gray-800 border border-gray-600 text-white text-sm px-3 py-2 outline-none focus:border-yellow-500"
            />
            <button
              onClick={handleJoin}
              disabled={!connected || !joinCode.trim()}
              className="rounded-xl px-4 py-2 bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      ) : (
        // In lobby: waiting room
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
            <p className="text-xs text-gray-400 mb-1">Game ID (share with friends)</p>
            <p className="text-sm font-mono text-yellow-300 break-all">{gameId}</p>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
            <p className="text-xs text-gray-400 mb-2">Players ({lobby.players?.length ?? 0}/5)</p>
            <div className="flex flex-col gap-1">
              {lobby.players?.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${p.id === lobby.hostId ? 'bg-yellow-400' : 'bg-green-400'}`} />
                  <span className="text-sm text-white">{p.name}</span>
                  {p.id === lobby.hostId && <span className="text-[10px] text-yellow-400">Host</span>}
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <button
              onClick={startGame}
              disabled={(lobby.players?.length ?? 0) < 2}
              className="rounded-xl py-3 bg-green-600 text-white font-bold text-sm hover:bg-green-500 disabled:opacity-50 transition-colors"
            >
              {(lobby.players?.length ?? 0) < 2 ? 'Waiting for players…' : 'Start Game'}
            </button>
          ) : (
            <p className="text-center text-sm text-gray-400">Waiting for host to start…</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Game page ────────────────────────────────────────────────────────────────

function GamePage() {
  const { gameId: routeGameId } = useParams();
  const { gameState, phase, telegramId, name } = useGame();
  const { joinGame, connected } = useGame();

  // Rejoin on page refresh
  useEffect(() => {
    if (!gameState && connected && routeGameId) {
      const { telegramId, name } = getTelegramUser();
      joinGame(routeGameId, telegramId, name);
    }
  }, [connected, gameState, routeGameId, joinGame]);

  return <Board />;
}
