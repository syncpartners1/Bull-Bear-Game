// client/src/components/Portfolio.jsx
import Card from './Card.jsx';
import MissionCard from './MissionCard.jsx';

export default function Portfolio({ player, isMe = false, compact = false, onCardSelect, selectedCardId }) {
  if (!player) return null;

  const { portfolio = [], missions = [], score = 0, name } = player;
  const connected = player.connected !== false;

  return (
    <div className={`rounded-xl border ${isMe ? 'border-yellow-500' : 'border-gray-700'} bg-gray-900/70 p-2`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-500'}`} />
          <span className={`text-xs font-semibold ${isMe ? 'text-yellow-300' : 'text-gray-200'}`}>
            {name} {isMe && '(You)'}
          </span>
        </div>
        <span className="text-xs font-bold text-white bg-gray-700 rounded-full px-2 py-0.5">
          {score} pts
        </span>
      </div>

      {/* Cards */}
      {compact ? (
        <CompactPortfolio
          portfolio={portfolio}
          onCardSelect={onCardSelect}
          selectedCardId={selectedCardId}
        />
      ) : (
        <FullPortfolio
          portfolio={portfolio}
          missions={missions}
          onCardSelect={onCardSelect}
          selectedCardId={selectedCardId}
        />
      )}
    </div>
  );
}

function CompactPortfolio({ portfolio, onCardSelect, selectedCardId }) {
  return (
    <div className="flex flex-wrap gap-1">
      {portfolio.length === 0 && (
        <span className="text-[10px] text-gray-500 italic">No cards yet</span>
      )}
      {portfolio.map((card) => (
        <Card
          key={card.id}
          card={card}
          faceDown={card.faceDown}
          small
          selected={card.id === selectedCardId}
          onClick={() => onCardSelect?.(card)}
        />
      ))}
    </div>
  );
}

function FullPortfolio({ portfolio, missions, onCardSelect, selectedCardId }) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {portfolio.length === 0 && (
          <span className="text-xs text-gray-500 italic">No cards yet</span>
        )}
        {portfolio.map((card) => (
          <Card
            key={card.id}
            card={card}
            faceDown={card.faceDown}
            selected={card.id === selectedCardId}
            onClick={() => onCardSelect?.(card)}
          />
        ))}
      </div>

      {missions.length > 0 && (
        <div>
          <div className="text-[9px] uppercase tracking-widest text-gray-500 mb-1">Missions</div>
          <div className="flex gap-1.5">
            {missions.map((m) => (
              <MissionCard key={m.id} mission={m} showBack={m.faceDown} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
