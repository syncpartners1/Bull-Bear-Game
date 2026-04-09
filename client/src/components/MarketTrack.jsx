// client/src/components/MarketTrack.jsx
import Card from './Card.jsx';
import { SECTOR_META } from '../utils/cardAssets.js';

const INDEX_STYLE = {
  1:  { label: '+1', color: 'text-green-400', bg: 'bg-green-900/40', border: 'border-green-500' },
  0:  { label: '0',  color: 'text-gray-400',  bg: 'bg-gray-800',     border: 'border-gray-600' },
  '-1':{ label: '-1', color: 'text-red-400',  bg: 'bg-red-900/40',   border: 'border-red-500'  },
};

export default function MarketTrack({ sector, marketData, onZoneSelect, selectedZone }) {
  const meta = SECTOR_META[sector];
  const { bull = [], bear = [], index = 0 } = marketData ?? {};
  const idxStyle = INDEX_STYLE[index] ?? INDEX_STYLE[0];

  return (
    <div className="flex flex-col gap-1 rounded-xl border border-gray-700 bg-gray-900/60 p-2">
      {/* Sector header */}
      <div className="flex items-center justify-between px-1">
        <span
          className="text-xs font-bold rounded px-2 py-0.5 text-white"
          style={{ backgroundColor: meta.color }}
        >
          {meta.label}
        </span>
        <div className={`rounded-full border ${idxStyle.border} ${idxStyle.bg} px-2 py-0.5`}>
          <span className={`text-xs font-bold ${idxStyle.color}`}>{idxStyle.label}</span>
        </div>
      </div>

      {/* Bull zone */}
      <Zone
        label="BULL"
        cards={bull}
        bgColor="bg-green-950/40"
        borderColor="border-green-800"
        labelColor="text-green-400"
        active={selectedZone === 'bull'}
        onClick={() => onZoneSelect && onZoneSelect(sector, 'bull')}
        showSelect={!!onZoneSelect}
      />

      {/* Bear zone */}
      <Zone
        label="BEAR"
        cards={bear}
        bgColor="bg-red-950/40"
        borderColor="border-red-800"
        labelColor="text-red-400"
        active={selectedZone === 'bear'}
        onClick={() => onZoneSelect && onZoneSelect(sector, 'bear')}
        showSelect={!!onZoneSelect}
      />
    </div>
  );
}

export function Zone({ label, cards, bgColor, borderColor, labelColor, active, onClick, showSelect }) {
  return (
    <div
      className={`rounded-lg border ${borderColor} ${bgColor} p-1.5 min-h-[52px]
        ${showSelect ? 'cursor-pointer' : ''}
        ${active ? 'ring-2 ring-yellow-400' : ''}
        transition-all`}
      onClick={onClick}
    >
      <div className={`text-[9px] font-bold ${labelColor} mb-1 uppercase tracking-widest`}>
        {label} ({cards.length})
      </div>
      <div className="flex flex-wrap gap-1">
        {cards.map((card) => (
          <Card key={card.id} card={card} faceDown={card.faceDown} small />
        ))}
        {cards.length === 0 && (
          <span className="text-[10px] text-gray-600 italic">Empty</span>
        )}
      </div>
    </div>
  );
}
