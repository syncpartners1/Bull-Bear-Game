// client/src/App.jsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import { GameProvider, useGame } from './context/GameContext.jsx';
import Board from './components/Board.jsx';
import ScoreBoard from './components/ScoreBoard.jsx';
import logoSrc from './assets/Bull_and_Bear_logo.png';

// ─── Telegram bootstrap ───────────────────────────────────────────────────────

function getTelegramUser() {
  try {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      const u = tg.initDataUnsafe.user;
      return {
        telegramId: String(u.id),
        name: u.username ? `@${u.username}` : ((u.first_name + (u.last_name ? ` ${u.last_name}` : '')) || u.username || 'Player'),
      };
    }
  } catch (_) {}
  const id = localStorage.getItem('bb_devId') || String(Math.floor(Math.random() * 9000) + 1000);
  localStorage.setItem('bb_devId', id);
  return { telegramId: id, name: `Player_${id.slice(-3)}` };
}

/** Read ?mode=ai or ?startapp=GAMEID from the URL (Telegram deep-links) */
function getStartParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    startGameId: params.get('startapp') || '',
    aiMode:      params.get('mode') === 'ai',
  };
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      if (tg.themeParams?.bg_color)
        document.documentElement.style.setProperty('--tg-bg-color', tg.themeParams.bg_color);
      if (tg.themeParams?.button_color)
        document.documentElement.style.setProperty('--tg-button-color', tg.themeParams.button_color);
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
  const { finalScores } = useGame();
  if (finalScores) return <ScoreBoard />;
  return (
    <>
      <ServerStatusBanner />
      <Routes>
        <Route path="/"            element={<LobbyPage />} />
        <Route path="/game/:gameId" element={<GamePage />} />
      </Routes>
    </>
  );
}

// ─── Server status / Railway wake-up banner ───────────────────────────────────

function ServerStatusBanner() {
  const { connected } = useGame();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (connected) { setElapsed(0); return; }
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

  if (connected) return null;          // hide once connected
  if (elapsed < 5) return null;        // brief grace period — normal connect delay

  let msg, colour;
  if (elapsed < 20) {
    msg    = 'Connecting to server…';
    colour = 'bg-yellow-900/60 border-yellow-600 text-yellow-300';
  } else if (elapsed < 50) {
    msg    = 'Railway server may be waking up — this can take up to 60 s on the hobby tier.';
    colour = 'bg-orange-900/60 border-orange-600 text-orange-300';
  } else {
    msg    = 'Server is taking unusually long. It may be paused on Railway — check your Railway dashboard.';
    colour = 'bg-red-900/60 border-red-600 text-red-300';
  }

  return (
    <div className={`w-full px-3 py-2 border-b text-xs text-center ${colour}`}>
      ⚠ {msg}
    </div>
  );
}

// ─── Logo component ───────────────────────────────────────────────────────────

function LogoOrTitle() {
  const [imgFailed, setImgFailed] = useState(false);
  if (imgFailed) {
    return (
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">
          Bull <span className="text-green-400">↑</span> Bear <span className="text-red-400">↓</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">Multiplayer Financial Strategy</p>
      </div>
    );
  }
  return (
    <img
      src={logoSrc}
      alt="Bull & Bear"
      className="w-40 h-40 object-contain"
      onError={() => setImgFailed(true)}
    />
  );
}

// ─── Lobby page ───────────────────────────────────────────────────────────────

function LobbyPage() {
  const { telegramId, name } = getTelegramUser();
  const { startGameId, aiMode: startInAiMode } = getStartParams();

  const {
    createGame, joinGame, startGame, leaveGame,
    lobby, myPlayer, gameId, phase,
    connected, lastError, clearError,
  } = useGame();

  const navigate    = useNavigate();
  const [joinCode,  setJoinCode]  = useState(startGameId);
  const [mode,      setMode]      = useState(startInAiMode ? 'ai' : 'players');
  const [aiCount,   setAiCount]   = useState(1);
  const [autoStart, setAutoStart] = useState(false);
  const [showHowToPlay, setShowHowToPlay] = useState(false);

  // Derived state — must be declared before any useEffect that references them
  const isHost      = lobby?.hostId === myPlayer?.id;
  const humanCount  = lobby?.players?.length ?? 0;
  const totalWithAI = humanCount + aiCount;
  const canStart    = totalWithAI >= 2 && totalWithAI <= 4;

  // Navigate to the game board only once the game has actually started
  useEffect(() => {
    if (phase === 'playing' && gameId) {
      localStorage.setItem('bb_last_game_id', gameId);
      navigate(`/game/${gameId}`);
    }
    if (phase === 'finished') {
      localStorage.removeItem('bb_last_game_id');
    }
  }, [phase, gameId, navigate]);

  useEffect(() => {
    if (connected && !gameId) {
      if (startGameId) {
        joinGame(startGameId, telegramId, name);
      } else {
        const lastId = localStorage.getItem('bb_last_game_id');
        if (lastId) joinGame(lastId, telegramId, name);
      }
    }
  }, [connected, startGameId, gameId, telegramId, name, joinGame]);

  // Auto-start once lobby is ready in AI mode (user is always host here)
  useEffect(() => {
    if (autoStart && lobby && isHost && phase !== 'playing') {
      startGame(aiCount);
      setAutoStart(false);
    }
  }, [autoStart, lobby, isHost, phase, aiCount, startGame]);

  function handleCreate() { createGame(telegramId, name); }

  function handleJoin() {
    const code = joinCode.trim();
    if (!code) return;
    joinGame(code, telegramId, name);
  }

  function handleStart() {
    startGame(aiCount);
  }

  function handleLeave() {
    leaveGame();
  }

  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-5 overflow-y-auto">

      <LogoOrTitle />

      <div className="text-center w-full max-w-xs mt-[-10px]">
        <button onClick={() => setShowHowToPlay(true)} className="text-xs text-blue-400 underline hover:text-blue-300">
          How to Play & Rules
        </button>
      </div>

      <div className={`text-xs ${connected ? 'text-green-400' : 'text-red-400'}`}>
        {connected ? '● Connected' : '○ Connecting…'}
      </div>

      {lastError && (
        <div className="bg-red-900/50 border border-red-600 rounded-lg p-3 text-sm text-red-300 w-full max-w-xs flex items-center justify-between">
          <span>{lastError}</span>
          <button onClick={clearError} className="ml-2 text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {!lobby ? (
        <div className="flex flex-col gap-3 w-full max-w-xs">

          <div className="flex rounded-xl overflow-hidden border border-gray-700">
            <button
              onClick={() => setMode('players')}
              className={`flex-1 py-2 text-sm font-semibold transition-colors
                ${mode === 'players' ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400'}`}
            >
              👥 vs Players
            </button>
            <button
              onClick={() => setMode('ai')}
              className={`flex-1 py-2 text-sm font-semibold transition-colors
                ${mode === 'ai' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}
            >
              🤖 vs AI
            </button>
          </div>

          {mode === 'ai' ? (
            <div className="flex flex-col gap-3">
              <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
                <p className="text-xs text-gray-400 mb-2">Number of AI opponents</p>
                <div className="flex gap-2 justify-center">
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      onClick={() => setAiCount(n)}
                      className={`w-10 h-10 rounded-lg font-bold text-sm border transition-colors
                        ${aiCount === n
                          ? 'border-blue-400 bg-blue-700 text-white'
                          : 'border-gray-600 bg-gray-700 text-gray-300'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => { handleCreate(); setAutoStart(true); }}
                disabled={!connected}
                className="rounded-xl py-3 bg-blue-600 text-white font-bold text-sm hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                🤖 Start vs {aiCount} AI
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
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
                  placeholder="Game ID to join"
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
          )}
        </div>

      ) : (
        <div className="flex flex-col gap-3 w-full max-w-xs">

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
            <p className="text-xs text-gray-400 mb-1">Game ID — share with friends</p>
            <div className="flex items-center gap-2">
              <p className="text-2xl font-mono font-bold tracking-widest text-yellow-300">{gameId}</p>
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => {
                    const url = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin + '?startapp=' + gameId)}&text=${encodeURIComponent('Join my Bull & Bear game!')}`;
                    if (window.Telegram?.WebApp?.openTelegramLink) {
                      window.Telegram.WebApp.openTelegramLink(url);
                    } else {
                      window.open(url, '_blank');
                    }
                  }}
                  className="text-xs bg-blue-600 text-white hover:bg-blue-500 rounded px-3 py-1 font-bold transition-colors"
                >
                  Invite
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard?.writeText(gameId);
                    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred('success');
                  }}
                  className="text-[10px] text-gray-500 hover:text-yellow-300 border border-gray-600 rounded px-1.5 py-0.5 transition-colors"
                  title="Copy ID"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
            <p className="text-xs text-gray-400 mb-2">
              Players ({humanCount}/4){mode === 'ai' ? ` + ${aiCount} AI` : ''}
            </p>
            <div className="flex flex-col gap-1">
              {lobby.players?.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${p.id === lobby.hostId ? 'bg-yellow-400' : 'bg-green-400'}`} />
                  <span className="text-sm text-white">{p.name}</span>
                  {p.id === lobby.hostId && <span className="text-[10px] text-yellow-400">Host</span>}
                </div>
              ))}
              {mode === 'ai' && Array.from({ length: aiCount }, (_, i) => {
                const AI_NAMES = ['Hunter', 'Jess', 'Mandy', 'Ruth'];
                return (
                  <div key={`ai-${i}`} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span className="text-sm text-blue-300">🤖 {AI_NAMES[i % AI_NAMES.length]}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {isHost && (
            <div className="rounded-xl border border-gray-700 bg-gray-800 p-3">
              <p className="text-xs text-gray-400 mb-2">🤖 AI bots (optional)</p>
              <div className="flex gap-2 flex-wrap">
                {[0, 1, 2, 3].filter((n) => humanCount + n <= 4).map((n) => (
                  <button
                    key={n}
                    onClick={() => setAiCount(n)}
                    className={`w-10 h-10 rounded-lg font-bold text-sm border transition-colors
                      ${aiCount === n ? 'border-blue-400 bg-blue-700 text-white' : 'border-gray-600 bg-gray-700 text-gray-300'}`}
                  >
                    {n === 0 ? '—' : n}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart}
            className="rounded-xl py-3 bg-green-600 text-white font-bold text-sm hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            {canStart ? `Start Game (${totalWithAI} players)` : totalWithAI > 4 ? 'Maximum 4 players' : 'Need at least 2 players total'}
          </button>
          
          <button
            onClick={handleLeave}
            className="rounded-xl py-2 bg-gray-700 text-gray-300 text-xs hover:bg-gray-600 transition-colors"
          >
            Leave Lobby
          </button>

          {!isHost && (
            <p className="text-center text-[10px] text-gray-500">
              Only the host can adjust AI bots, but anyone can start the game.
            </p>
          )}
        </div>
      )}

      {showHowToPlay && <HowToPlayModal onClose={() => setShowHowToPlay(false)} />}
    </div>
  );
}

// ─── Game page ────────────────────────────────────────────────────────────────

function GamePage() {
  const { gameId: routeGameId } = useParams();
  const { gameState, joinGame, connected } = useGame();

  useEffect(() => {
    if (!gameState && connected && routeGameId) {
      const { telegramId, name } = getTelegramUser();
      joinGame(routeGameId, telegramId, name);
    }
  }, [connected, gameState, routeGameId, joinGame]);

  return <Board />;
}

// ─── How to Play Modal ────────────────────────────────────────────────────────

function HowToPlayModal({ onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 max-w-sm w-full max-h-[85vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-yellow-400">How to Play</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white bg-gray-800 rounded-full w-8 h-8 flex items-center justify-center">✕</button>
        </div>
        <div className="space-y-4 text-sm text-gray-300">
          <p><strong>Goal:</strong> Gain the most points by manipulating the market, fulfilling hidden missions, and building your portfolio.</p>
          <div className="bg-gray-800 p-3 rounded-lg border border-gray-700">
            <h3 className="font-bold text-white mb-1">Your Turn:</h3>
             Every turn you draw 3 cards. You must play:
             <ul className="list-disc pl-5 mt-1 space-y-1">
               <li>One to the <strong>Market</strong></li>
               <li>One to <strong>Your Portfolio</strong></li>
               <li>One to an <strong>Opponent's Portfolio</strong></li>
             </ul>
             <p className="mt-1 italic text-gray-400 text-xs">You can play them in any order!</p>
          </div>
          <p><strong>The Market:</strong> Divided into 4 sectors (Tech, Finance, Energy, Pharma). Playing a Bull card here increases the sector's value. A Bear card decreases it.</p>
          <p><strong>Scoring:</strong> At the end of the game, each standard stock card in your portfolio is worth points equal to its market's final index (-1, 0, +1, or +2). Fulfilling your strategy and market missions gives substantial bonuses!</p>
          <div>
            <strong>Special Cards:</strong>
            <ul className="list-disc pl-5 mt-1 space-y-1">
               <li><span className="text-red-400 font-bold">Hostile Takeover:</span> Destroys any card in play.</li>
               <li><span className="text-blue-400 font-bold">Insider Trading:</span> Hidden sector until the end of the game when played to the market.</li>
               <li><span className="text-purple-400 font-bold">Pivot:</span> Allows you to choose its sector dynamically.</li>
            </ul>
          </div>
          <button onClick={onClose} className="w-full mt-4 bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded-lg">
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
