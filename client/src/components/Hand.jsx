// client/src/components/Hand.jsx
import { useState } from 'react';
import Card from './Card.jsx';
import { useGame } from '../hooks/useGame.js';
import { SECTOR_META } from '../utils/cardAssets.js';

const STEP_LABELS = {
  allocate_portfolio: { label: 'Step 1 of 3', hint: 'Add a card to your portfolio', color: 'text-yellow-400' },
  allocate_market:    { label: 'Step 2 of 3', hint: 'Place a card in the Market',   color: 'text-blue-400'   },
  allocate_opponent:  { label: 'Step 3 of 3', hint: "Add a card to an opponent's portfolio", color: 'text-red-400' },
  end_turn:           { label: 'Turn done',   hint: 'Waiting for confirmation',      color: 'text-green-400' },
};

const SECTORS = ['tech', 'finance', 'energy', 'pharma'];

export default function Hand() {
  const {
    myTurnCards,
    gameState,
    myPlayer,
    isMyTurn,
    pendingAbility,
    allocateCard,
    activateHostileTakeover,
    skipHostileTakeover,
  } = useGame();

  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedSector, setSelectedSector] = useState(null);
  const [selectedZone, setSelectedZone] = useState(null);
  const [selectedOpponent, setSelectedOpponent] = useState(null);
  const [targetCard, setTargetCard] = useState(null);
  const [targetLocation, setTargetLocation] = useState(null); // 'portfolio' | 'market'

  const turnStep = gameState?.turnStep;
  const stepMeta = STEP_LABELS[turnStep] ?? {};
  const opponents = gameState?.players?.filter((p) => p.id !== myPlayer?.id) ?? [];

  // ── Hostile takeover UI ───────────────────────────────────────────────────
  if (pendingAbility) {
    return (
      <HostileTakeoverUI
        gameState={gameState}
        myPlayer={myPlayer}
        targetCard={targetCard}
        targetLocation={targetLocation}
        setTargetCard={setTargetCard}
        setTargetLocation={setTargetLocation}
        onActivate={(target) => {
          activateHostileTakeover(target);
          setTargetCard(null);
          setTargetLocation(null);
        }}
        onSkip={() => {
          skipHostileTakeover();
          setTargetCard(null);
          setTargetLocation(null);
        }}
      />
    );
  }

  if (!isMyTurn) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 text-center">
        <p className="text-sm text-gray-400">
          Waiting for <span className="text-white font-semibold">
            {gameState?.players[gameState?.currentPlayerIndex]?.name}
          </span>…
        </p>
      </div>
    );
  }

  if (!myTurnCards || myTurnCards.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4 text-center">
        <p className="text-sm text-gray-400">Drawing cards…</p>
      </div>
    );
  }

  // ── Confirm button logic ───────────────────────────────────────────────────
  const canConfirm =
    selectedCard &&
    (turnStep === 'allocate_portfolio' ||
      (turnStep === 'allocate_market' && selectedSector && selectedZone) ||
      (turnStep === 'allocate_opponent' && selectedOpponent));

  function handleConfirm() {
    if (!canConfirm) return;
    const step = turnStep.replace('allocate_', '');
    const extra = {};
    if (step === 'market') { extra.sector = selectedSector; extra.zone = selectedZone; }
    if (step === 'opponent') { extra.targetPlayerId = selectedOpponent; }
    allocateCard(selectedCard.id, step, extra);
    setSelectedCard(null);
    setSelectedSector(null);
    setSelectedZone(null);
    setSelectedOpponent(null);
    window.Telegram?.WebApp?.MainButton?.hide?.();
  }

  // Show Telegram MainButton when ready
  if (canConfirm) {
    const tgBtn = window.Telegram?.WebApp?.MainButton;
    tgBtn?.setText('Confirm');
    tgBtn?.show?.();
    tgBtn?.onClick?.(handleConfirm);
  } else {
    window.Telegram?.WebApp?.MainButton?.hide?.();
  }

  return (
    <div className="rounded-xl border border-yellow-600/50 bg-gray-900/80 p-3 flex flex-col gap-3">
      {/* Step indicator */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${stepMeta.color}`}>{stepMeta.label}</span>
        <span className="text-xs text-gray-400">{stepMeta.hint}</span>
      </div>

      {/* Cards in hand */}
      <div className="flex gap-2 justify-center">
        {myTurnCards.map((card) => (
          <Card
            key={card.id}
            card={card}
            faceDown={false}
            selected={selectedCard?.id === card.id}
            onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
          />
        ))}
      </div>

      {/* Step-specific targeting */}
      {selectedCard && turnStep === 'allocate_market' && (
        <MarketTargetSelector
          selectedSector={selectedSector}
          selectedZone={selectedZone}
          onSelect={(sector, zone) => { setSelectedSector(sector); setSelectedZone(zone); }}
        />
      )}

      {selectedCard && turnStep === 'allocate_opponent' && (
        <OpponentSelector
          opponents={opponents}
          selectedId={selectedOpponent}
          onSelect={setSelectedOpponent}
        />
      )}

      {/* Confirm button */}
      <button
        disabled={!canConfirm}
        onClick={handleConfirm}
        className={`rounded-lg py-2 text-sm font-bold transition-colors
          ${canConfirm
            ? 'bg-yellow-500 text-black hover:bg-yellow-400 active:bg-yellow-600'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
      >
        Confirm
      </button>
    </div>
  );
}

function MarketTargetSelector({ selectedSector, selectedZone, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-400 text-center">Choose sector and zone:</p>
      <div className="grid grid-cols-2 gap-1">
        {SECTORS.map((sector) => (
          <div key={sector} className="flex flex-col gap-1">
            {['bull', 'bear'].map((zone) => {
              const active = selectedSector === sector && selectedZone === zone;
              return (
                <button
                  key={zone}
                  onClick={() => onSelect(sector, zone)}
                  className={`text-[10px] rounded-lg px-2 py-1.5 font-semibold border transition-colors
                    ${active
                      ? 'border-yellow-400 bg-yellow-900/50 text-yellow-300'
                      : zone === 'bull'
                        ? 'border-green-700 bg-green-950/40 text-green-400 hover:bg-green-900/50'
                        : 'border-red-700 bg-red-950/40 text-red-400 hover:bg-red-900/50'}`}
                >
                  {SECTOR_META[sector]?.label} {zone === 'bull' ? '▲' : '▼'}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function OpponentSelector({ opponents, selectedId, onSelect }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-gray-400 text-center">Choose an opponent:</p>
      <div className="flex flex-wrap gap-1.5 justify-center">
        {opponents.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors
              ${selectedId === p.id
                ? 'border-yellow-400 bg-yellow-900/50 text-yellow-300'
                : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-500'}`}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function HostileTakeoverUI({ gameState, myPlayer, targetCard, targetLocation, setTargetCard, setTargetLocation, onActivate, onSkip }) {
  const [selectedTarget, setSelectedTarget] = useState(null);

  const allPlayers = gameState?.players ?? [];
  const market = gameState?.market ?? {};
  const SECTORS = ['tech', 'finance', 'energy', 'pharma'];

  function handlePortfolioCard(player, card) {
    if (card.type === 'regulated_asset') return; // blocked
    setSelectedTarget({ location: 'portfolio', playerId: player.id, cardId: card.id });
  }

  function handleMarketCard(sector, zone, card) {
    if (card.type === 'regulated_asset') return;
    setSelectedTarget({ location: 'market', sector, zone, cardId: card.id });
  }

  return (
    <div className="rounded-xl border border-red-600 bg-red-950/30 p-3 flex flex-col gap-3">
      <div className="text-center">
        <p className="text-sm font-bold text-red-400">⚔️ Hostile Takeover</p>
        <p className="text-xs text-gray-400 mt-0.5">Select a card to remove (cannot remove Regulated Assets)</p>
      </div>

      {/* Portfolio targets */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Portfolios</p>
        <div className="flex flex-col gap-1.5">
          {allPlayers.map((player) => (
            <div key={player.id}>
              <p className="text-[10px] text-gray-400 mb-1">{player.name}{player.id === myPlayer?.id ? ' (You)' : ''}</p>
              <div className="flex flex-wrap gap-1">
                {player.portfolio.map((card) => (
                  <div
                    key={card.id}
                    className={`relative ${card.type === 'regulated_asset' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                    onClick={() => handlePortfolioCard(player, card)}
                  >
                    <Card
                      card={card}
                      faceDown={card.faceDown}
                      small
                      selected={selectedTarget?.cardId === card.id && selectedTarget?.location === 'portfolio'}
                    />
                    {card.type === 'regulated_asset' && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs">🛡️</span>
                      </div>
                    )}
                  </div>
                ))}
                {player.portfolio.length === 0 && (
                  <span className="text-[10px] text-gray-600 italic">Empty</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Market targets */}
      <div>
        <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1">Market</p>
        <div className="flex flex-col gap-1">
          {SECTORS.map((sector) => (
            <div key={sector}>
              {['bull', 'bear'].map((zone) => {
                const cards = market[sector]?.[zone] ?? [];
                return cards.length > 0 ? (
                  <div key={zone} className="flex items-center gap-1 mb-1">
                    <span className="text-[9px] text-gray-500 w-16 shrink-0">
                      {SECTOR_META[sector]?.label} {zone}
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {cards.map((card) => (
                        <div
                          key={card.id}
                          className={`relative ${card.type === 'regulated_asset' ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                          onClick={() => handleMarketCard(sector, zone, card)}
                        >
                          <Card
                            card={card}
                            faceDown={card.faceDown}
                            small
                            selected={selectedTarget?.cardId === card.id && selectedTarget?.location === 'market'}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          disabled={!selectedTarget}
          onClick={() => selectedTarget && onActivate(selectedTarget)}
          className={`flex-1 rounded-lg py-2 text-sm font-bold transition-colors
            ${selectedTarget
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
        >
          Remove Card
        </button>
        <button
          onClick={onSkip}
          className="flex-1 rounded-lg py-2 text-sm font-bold bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
