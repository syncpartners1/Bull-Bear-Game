// client/src/components/Board.jsx
import { useState, useEffect } from 'react';
import MarketTrack from './MarketTrack.jsx';
import Portfolio from './Portfolio.jsx';
import Hand from './Hand.jsx';
import { useGame } from '../hooks/useGame.js';

const SECTORS = ['tech', 'finance', 'energy', 'pharma'];

export default function Board() {
  const { gameState, myPlayer, currentPlayer, isMyTurn, opponents } = useGame();

  if (!gameState) {
    return <LoadingScreen />;
  }

  const { market, players, phase, deck } = gameState;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-950 px-2 py-2 gap-2">
      {/* Status bar */}
      <StatusBar phase={phase} deckCount={deck?.length ?? 0} currentPlayer={currentPlayer} isMyTurn={isMyTurn} />

      {/* Opponent portfolios (compact, top) */}
      <div className="flex gap-2 overflow-x-auto shrink-0">
        {opponents.map((p) => (
          <div key={p.id} className="min-w-[140px]">
            <Portfolio player={p} compact />
          </div>
        ))}
      </div>

      {/* Market tracks — 2×2 grid */}
      <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-auto min-h-0">
        {SECTORS.map((sector) => (
          <MarketTrack
            key={sector}
            sector={sector}
            marketData={market?.[sector]}
          />
        ))}
      </div>

      {/* My portfolio (compact) */}
      {myPlayer && (
        <div className="shrink-0">
          <Portfolio
            player={players?.find((p) => p.id === myPlayer.id)}
            isMe
            compact
          />
        </div>
      )}

      {/* Hand (turn controls) */}
      <div className="shrink-0">
        <Hand />
      </div>
    </div>
  );
}


// ─── Loading screen with progress bar + event log ─────────────────────────────
 
function LoadingScreen() {
  const { connected, phase, myPlayer, lastError } = useGame();
  const [elapsed, setElapsed] = useState(0);
 
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);
 
  // Steps in order; the last one ("Receiving state") is never marked done here
  // because if it were, gameState would be set and this screen wouldn't render.
  const steps = [
    { label: 'Server connection', done: connected },
    { label: 'Joined game',       done: !!myPlayer },
    { label: 'Game started',      done: phase === 'playing' },
    { label: 'Receiving state',   done: false },
  ];
 
  const doneCount = steps.filter((s) => s.done).length;
  // Each done step = 25 %; active step pulses between 0–12 %
  const pct = Math.min(97, doneCount * 25 + (doneCount < steps.length ? 8 : 0));
 
  const isStuck = elapsed >= 12;
 
  // Build the debug log entries
  const log = [];
  if (connected)
    log.push({ ok: true,  text: 'Socket connected to server' });
  else
    log.push({ ok: false, text: 'Waiting for socket connection…' });
 
  if (myPlayer)
    log.push({ ok: true,  text: `Joined as "${myPlayer.name}"` });
  else if (connected)
    log.push({ ok: false, text: 'join_game emitted — awaiting server ack…' });
 
  if (phase === 'playing')
    log.push({ ok: true,  text: 'game_started received from server' });
  else if (myPlayer)
    log.push({ ok: false, text: 'Waiting for host to start the game…' });
 
  if (phase === 'playing' && myPlayer)
    log.push({ ok: false, text: 'Waiting for initial game_state event…' });
 
  if (lastError)
    log.push({ ok: false, text: `Server error: ${lastError}` });
 
  if (isStuck && !lastError)
    log.push({ ok: false, text: 'No game_state after 12 s — server may be busy or the game has no host.' });
 
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 gap-5">
 
      {/* Title */}
      <div className="text-center">
        <p className="text-white font-semibold text-sm">
          {isStuck ? 'Still loading…' : 'Loading game…'}
        </p>
        <p className="text-gray-500 text-xs mt-0.5">{elapsed}s elapsed</p>
      </div>
 
      {/* Progress bar */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between text-[10px] text-gray-500 mb-1">
          <span>Step {Math.min(doneCount + 1, steps.length)} / {steps.length}</span>
          <span>{Math.round(pct)}%</span>
        </div>
 
        {/* Track */}
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: isStuck ? '#f87171' : '#facc15',
            }}
          />
        </div>
 
        {/* Step dots */}
        <div className="flex justify-between mt-2">
          {steps.map((step, i) => (
            <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
              <span
                className={`text-sm leading-none ${
                  step.done
                    ? 'text-green-400'
                    : i === doneCount
                    ? 'text-yellow-300 animate-pulse'
                    : 'text-gray-600'
                }`}
              >
                {step.done ? '●' : i === doneCount ? '◉' : '○'}
              </span>
              <span
                className={`text-[8px] text-center leading-tight ${
                  step.done ? 'text-green-500' : i === doneCount ? 'text-yellow-400' : 'text-gray-600'
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      </div>
 
      {/* Debug log */}
      <div className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl p-3">
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">
          Debug log
        </p>
        <div className="flex flex-col gap-1.5">
          {log.map((entry, i) => (
            <div
              key={i}
              className={`text-xs flex gap-2 ${entry.ok ? 'text-green-400' : 'text-amber-400'}`}
            >
              <span className="shrink-0">{entry.ok ? '✓' : '…'}</span>
              <span>{entry.text}</span>
            </div>
          ))}
          {lastError && (
            <div className="text-xs flex gap-2 text-red-400 mt-1 border-t border-gray-700 pt-1">
              <span className="shrink-0">✗</span>
              <span>{lastError}</span>
            </div>
          )}
        </div>
      </div>
 
      {/* Reload hint after timeout */}
      {isStuck && (
        <button
          onClick={() => window.location.reload()}
          className="text-xs text-gray-400 underline hover:text-white transition-colors"
        >
          Reload page
        </button>
      )}
    </div>
  );
}
 
// ─── In-game status bar ───────────────────────────────────────────────────────
 
function StatusBar({ phase, deckCount, currentPlayer, isMyTurn }) {
  return (
    <div className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-1.5 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-gray-500">
          {phase === 'playing' ? 'In Play' : phase}
        </span>
        <span className="text-xs text-gray-400">
          🃏 {deckCount} left
        </span>
      </div>
      <div className="text-xs">
        {isMyTurn ? (
          <span className="text-yellow-400 font-bold animate-pulse">Your turn</span>
        ) : (
          <span className="text-gray-400">
            <span className="text-white">{currentPlayer?.name}</span>'s turn
          </span>
        )}
      </div>
    </div>
  );
}
