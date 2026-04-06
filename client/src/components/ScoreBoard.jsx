// client/src/components/ScoreBoard.jsx
import MissionCard from './MissionCard.jsx';
import { SECTOR_META } from '../utils/cardAssets.js';
import { useGame } from '../hooks/useGame.js';

const SECTORS = ['tech', 'finance', 'energy', 'pharma'];

const INDEX_COLOR = { 1: 'text-green-400', 0: 'text-gray-400', '-1': 'text-red-400' };
const INDEX_LABEL = { 1: '+1 Bull', 0: '0 Neutral', '-1': '-1 Bear' };

export default function ScoreBoard() {
  const { finalScores, winnerId, gameState } = useGame();

  if (!finalScores || !gameState) return null;

  const { market } = gameState;

  const sorted = [...finalScores].sort((a, b) => b.score - a.score);

  function handlePlayAgain() {
    window.Telegram?.WebApp?.MainButton?.hide?.();
    window.location.href = '/';
  }

  // Set Telegram MainButton
  const tgBtn = window.Telegram?.WebApp?.MainButton;
  tgBtn?.setText('Play Again');
  tgBtn?.show?.();
  tgBtn?.onClick?.(handlePlayAgain);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gray-950 px-3 py-4 gap-4">
      {/* Title */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Game Over</h1>
        {winnerId ? (
          <p className="text-yellow-400 font-semibold mt-1">
            🏆 {sorted.find((s) => s.playerId === winnerId)?.name} wins!
          </p>
        ) : (
          <p className="text-yellow-400 font-semibold mt-1">🤝 It's a tie!</p>
        )}
      </div>

      {/* Market summary */}
      <div>
        <h2 className="text-xs uppercase tracking-widest text-gray-500 mb-2">Final Market Status</h2>
        <div className="grid grid-cols-4 gap-1.5">
          {SECTORS.map((sector) => {
            const idx = market?.[sector]?.index ?? 0;
            const meta = SECTOR_META[sector];
            return (
              <div key={sector} className="rounded-lg bg-gray-800 p-2 text-center">
                <div className="text-[10px] font-bold text-white mb-0.5">{meta.label}</div>
                <div className={`text-sm font-bold ${INDEX_COLOR[idx] ?? 'text-gray-400'}`}>
                  {INDEX_LABEL[idx] ?? '0'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Player scores */}
      <div className="flex flex-col gap-3">
        <h2 className="text-xs uppercase tracking-widest text-gray-500">Player Results</h2>
        {sorted.map((entry, rank) => (
          <PlayerResult key={entry.playerId} entry={entry} rank={rank} isWinner={entry.isWinner} />
        ))}
      </div>

      {/* Play again button (fallback for non-Telegram) */}
      <button
        onClick={handlePlayAgain}
        className="rounded-xl py-3 bg-yellow-500 text-black font-bold text-sm hover:bg-yellow-400 transition-colors"
      >
        Play Again
      </button>
    </div>
  );
}

function PlayerResult({ entry, rank, isWinner }) {
  const { name, score, sectorBreakdown = [], missions = [] } = entry;

  const missionBonus = missions.reduce((s, m) => s + (m.bonusPoints ?? 0), 0);
  const baseScore = score - missionBonus;

  return (
    <div className={`rounded-xl border p-3 ${isWinner ? 'border-yellow-500 bg-yellow-900/20' : 'border-gray-700 bg-gray-900/60'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-gray-400">#{rank + 1}</span>
          <span className={`font-semibold ${isWinner ? 'text-yellow-300' : 'text-white'}`}>
            {isWinner && '🏆 '}{name}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xl font-bold text-white">{score}</span>
          <span className="text-xs text-gray-400"> pts</span>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-4 gap-1 mb-2">
        {sectorBreakdown.map(({ sector, index, cards, contribution }) => (
          <div key={sector} className="rounded-lg bg-gray-800 p-1.5 text-center">
            <div className="text-[9px] font-semibold text-gray-300" style={{ color: SECTOR_META[sector]?.color }}>
              {SECTOR_META[sector]?.label}
            </div>
            <div className="text-[10px] text-gray-400">{cards.length} cards</div>
            <div className={`text-xs font-bold ${contribution > 0 ? 'text-green-400' : contribution < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {contribution > 0 ? '+' : ''}{contribution}
            </div>
          </div>
        ))}
      </div>

      {/* Score summary line */}
      <div className="text-xs text-gray-400 mb-2">
        Base: <span className="text-white">{baseScore}</span>
        {missionBonus !== 0 && (
          <> + Missions: <span className="text-purple-400">+{missionBonus}</span> = <span className="text-white font-bold">{score}</span></>
        )}
      </div>

      {/* Mission results */}
      {missions.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Missions</div>
          <div className="flex gap-1.5 flex-wrap">
            {missions.map((m) => (
              <MissionCard key={m.id} mission={m} showBack={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
