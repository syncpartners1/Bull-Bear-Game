// client/src/components/MissionCard.jsx
import { useState, useEffect } from 'react';
import { MISSION_BACK_PATHS, SECTOR_META } from '../utils/cardAssets.js';

const MISSION_TYPE_STYLE = {
  market:   { border: 'border-yellow-500', bg: 'bg-yellow-900/50', icon: '📊' },
  strategy: { border: 'border-purple-500', bg: 'bg-purple-900/50', icon: '🎯' },
};

export default function MissionCard({ mission, showBack = false }) {
  const [flipped, setFlipped] = useState(false);
  const prevShowBack = usePrevious(showBack);

  useEffect(() => {
    if (prevShowBack && !showBack) setFlipped(true);
  }, [showBack, prevShowBack]);

  if (!mission) return null;

  const style = MISSION_TYPE_STYLE[mission.missionType] ?? MISSION_TYPE_STYLE.strategy;
  const sectorMeta = mission.sector ? SECTOR_META[mission.sector] : null;

  return (
    <div
      className={`card-flip ${flipped ? 'flipped' : ''} w-24 h-32 rounded-xl`}
      style={{ perspective: 1000 }}
    >
      <div
        className="card-flip-inner w-full h-full relative"
        style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s' }}
      >
        {/* Front — mission details */}
        <div
          className={`card-face absolute inset-0 rounded-xl border-2 ${style.border} ${style.bg} flex flex-col p-2 shadow-lg`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className="flex items-center gap-1 mb-1">
            <span className="text-base">{style.icon}</span>
            <span className="text-[10px] font-bold text-white uppercase tracking-wide truncate">
              {mission.name}
            </span>
          </div>

          {sectorMeta && (
            <div
              className="text-[9px] font-semibold rounded px-1 py-0.5 mb-1 text-white text-center"
              style={{ backgroundColor: sectorMeta.color }}
            >
              {sectorMeta.label}
            </div>
          )}

          <p className="text-[9px] text-gray-300 flex-1 leading-tight line-clamp-4">
            {mission.description}
          </p>

          <div className="mt-1 text-center">
            {mission.achieved !== undefined ? (
              <div className={`text-xs font-bold ${mission.achieved ? 'text-green-400' : 'text-red-400'}`}>
                {mission.achieved ? `✓ +${mission.bonusPoints}pts` : '✗ Not achieved'}
              </div>
            ) : (
              <div className="text-[10px] text-yellow-400 font-semibold">{mission.bonusLabel}</div>
            )}
          </div>
        </div>

        {/* Back — mission card back image (market vs strategy have separate art) */}
        <div
          className="card-back absolute inset-0 rounded-xl overflow-hidden border-2 border-gray-600 shadow-lg"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <img
            src={MISSION_BACK_PATHS[mission.missionType] ?? MISSION_BACK_PATHS.strategy}
            alt="Mission"
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentElement.classList.add('bg-gray-700', 'flex', 'items-center', 'justify-center');
              e.target.parentElement.innerHTML = '<span class="text-2xl">🎴</span>';
            }}
          />
        </div>
      </div>
    </div>
  );
}

function usePrevious(value) {
  const [prev, setPrev] = useState(value);
  useEffect(() => { setPrev(value); }, [value]);
  return prev;
}
