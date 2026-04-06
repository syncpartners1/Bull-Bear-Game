// client/src/components/Board.jsx
import MarketTrack from './MarketTrack.jsx';
import Portfolio from './Portfolio.jsx';
import Hand from './Hand.jsx';
import { useGame } from '../hooks/useGame.js';

const SECTORS = ['tech', 'finance', 'energy', 'pharma'];

export default function Board() {
  const { gameState, myPlayer, currentPlayer, isMyTurn, opponents } = useGame();

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-sm">Loading game…</p>
      </div>
    );
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
