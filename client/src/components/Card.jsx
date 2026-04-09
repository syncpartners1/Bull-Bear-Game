// client/src/components/Card.jsx
import { useState, useEffect } from 'react';
import { getCardImagePath, SECTOR_META, CARD_TYPE_META, CARDS_BACK_URL } from '../utils/cardAssets.js';

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

export default function Card({ card, faceDown = false, selected = false, onClick, small = false, large = false }) {
  const [flipped, setFlipped] = useState(faceDown);
  const prevFaceDown = usePrevious(faceDown);

  useEffect(() => {
    if (prevFaceDown !== faceDown) {
      setFlipped(faceDown);
    }
  }, [faceDown, prevFaceDown]);

  const meta = CARD_TYPE_META[card?.type] ?? CARD_TYPE_META.hidden;
  const sectorMeta = SECTOR_META[card?.sector];
  const imgPath = card?.type && card?.type !== 'hidden' ? getCardImagePath(card.sector, card.type) : null;

  const sizeClass = large ? 'w-32 h-44 text-lg' : small ? 'w-16 h-24 text-xs' : 'w-24 h-32 text-sm';
  const borderColor = selected ? 'border-yellow-400 shadow-yellow-400/50' : (SECTOR_BORDER[card?.sector] ?? 'border-gray-600');

  return (
    <div
      className={`card-flip ${flipped ? 'flipped' : ''} ${sizeClass} cursor-pointer select-none`}
      onClick={onClick}
      style={{ perspective: 1000 }}
      aria-label={faceDown ? "Face down card" : `${meta.label}${card?.sector ? ` - ${SECTOR_META[card.sector]?.label}` : ''}`}
      title={faceDown ? "Unknown Card" : meta.label}
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
            <FallbackCardFace card={card} meta={meta} sectorMeta={sectorMeta} small={small} large={large} />
          )}
          {large && !faceDown && (
            <div className="absolute inset-x-0 bottom-0 bg-black/80 py-1.5 px-1 text-center border-t border-gray-600/50 backdrop-blur-sm z-10">
               <span className="font-bold text-xs uppercase tracking-wider text-white drop-shadow-sm">{meta.label}</span>
            </div>
          )}
          {selected && (
            <div className="absolute inset-0 rounded-xl border-2 border-yellow-400 animate-pulse pointer-events-none z-20" />
          )}
        </div>

        {/* Back face (shown when face-down) */}
        <div
          className={`card-back absolute inset-0 rounded-xl border-2 border-gray-600 bg-gray-800 flex items-center justify-center shadow-lg overflow-hidden`}
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {CARDS_BACK_URL ? (
            <img src={CARDS_BACK_URL} alt="Card Back" className="w-full h-full object-cover rounded-xl" />
          ) : (
            <span className="text-2xl text-gray-400">🂠</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FallbackCardFace({ card, meta, sectorMeta, small, large }) {
  return (
    <div className="flex flex-col h-full p-1">
      <div className="flex items-center justify-between">
        <span className={large ? 'text-lg' : small ? 'text-xs' : 'text-sm'}>{meta.icon}</span>
        <span className={`font-bold ${large ? 'text-lg' : small ? 'text-xs' : 'text-sm'} text-white`}>
          {card?.value ?? meta.value}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className={large ? 'text-4xl' : small ? 'text-lg' : 'text-2xl'}>{meta.icon}</span>
      </div>
      {sectorMeta && (
        <div
          className={`text-center rounded px-1 py-0.5 ${large ? 'text-sm' : small ? 'text-[9px]' : 'text-xs'} font-semibold text-white`}
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
