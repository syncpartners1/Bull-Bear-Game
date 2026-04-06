// client/src/components/Card.jsx
import { useState, useEffect } from 'react';
import { getCardImagePath, SECTOR_META, CARD_TYPE_META } from '../utils/cardAssets.js';

const SECTOR_BORDER = {
  tech:    'border-blue-500',
  finance: 'border-green-500',
  energy:  'border-orange-500',
  pharma:  'border-pink-500',
};

const SECTOR_BG = {
  tech:    'bg-blue-900/60',
  finance: 'bg-green-900/60',
  energy:  'bg-orange-900/60',
  pharma:  'bg-pink-900/60',
};

export default function Card({ card, faceDown = false, selected = false, onClick, small = false }) {
  const [flipped, setFlipped] = useState(false);
  const prevFaceDown = usePrevious(faceDown);

  // Animate flip when card goes from face-down to face-up
  useEffect(() => {
    if (prevFaceDown && !faceDown) {
      setFlipped(true);
    }
  }, [faceDown, prevFaceDown]);

  const meta = CARD_TYPE_META[card?.type] ?? CARD_TYPE_META.hidden;
  const sectorMeta = SECTOR_META[card?.sector];
  const imgPath = card?.type && card?.type !== 'hidden' ? getCardImagePath(card.sector, card.type) : null;

  const sizeClass = small ? 'w-14 h-20 text-xs' : 'w-20 h-28 text-sm';
  const borderColor = selected ? 'border-yellow-400 shadow-yellow-400/50' : (SECTOR_BORDER[card?.sector] ?? 'border-gray-600');

  return (
    <div
      className={`card-flip ${flipped ? 'flipped' : ''} ${sizeClass} cursor-pointer`}
      onClick={onClick}
      style={{ perspective: 1000 }}
    >
      <div className="card-flip-inner w-full h-full relative" style={{ transformStyle: 'preserve-3d', transition: 'transform 0.6s' }}>
        {/* Front face (shown when NOT face-down) */}
        <div
          className={`card-face absolute inset-0 rounded-xl border-2 ${borderColor} ${SECTOR_BG[card?.sector] ?? 'bg-gray-800'} flex flex-col overflow-hidden shadow-lg ${selected ? 'shadow-yellow-400/50 scale-105' : ''} transition-transform`}
          style={{ backfaceVisibility: 'hidden' }}
        >
          {imgPath ? (
            <img src={imgPath} alt={meta.label} className="w-full h-full object-cover rounded-xl" />
          ) : (
            <FallbackCardFace card={card} meta={meta} sectorMeta={sectorMeta} small={small} />
          )}
          {selected && (
            <div className="absolute inset-0 rounded-xl border-2 border-yellow-400 animate-pulse pointer-events-none" />
          )}
        </div>

        {/* Back face (shown when face-down) */}
        <div
          className={`card-back absolute inset-0 rounded-xl border-2 border-gray-600 bg-gray-800 flex items-center justify-center shadow-lg`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <span className="text-2xl">🂠</span>
        </div>
      </div>
    </div>
  );
}

function FallbackCardFace({ card, meta, sectorMeta, small }) {
  return (
    <div className="flex flex-col h-full p-1">
      <div className="flex items-center justify-between">
        <span className={small ? 'text-xs' : 'text-sm'}>{meta.icon}</span>
        <span className={`font-bold ${small ? 'text-xs' : 'text-sm'} text-white`}>
          {card?.value ?? meta.value}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className={small ? 'text-lg' : 'text-2xl'}>{meta.icon}</span>
      </div>
      {sectorMeta && (
        <div
          className={`text-center rounded px-1 py-0.5 ${small ? 'text-[9px]' : 'text-xs'} font-semibold text-white`}
          style={{ backgroundColor: sectorMeta.color }}
        >
          {sectorMeta.label}
        </div>
      )}
    </div>
  );
}

function usePrevious(value) {
  const [prev, setPrev] = useState(value);
  useEffect(() => { setPrev(value); }, [value]);
  return prev;
}
