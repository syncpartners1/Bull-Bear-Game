// client/src/components/Hand.jsx
import { useState } from 'react';
import Card from './Card.jsx';
import { useGame } from '../hooks/useGame.js';
import { SECTOR_META } from '../utils/cardAssets.js';

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
  const [pivotSector, setPivotSector] = useState(null);   // for Pivot card portfolio/opponent
  const [targetCard, setTargetCard] = useState(null);
  const [targetLocation, setTargetLocation] = useState(null); // 'portfolio' | 'market'

  const remainingActions = gameState?.remainingActions ?? [];
  const opponents = gameState?.players?.filter((p) => p.id !== myPlayer?.id) ?? [];
  const [selectedAction, setSelectedAction] = useState(null);

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
  const isPivot = selectedCard?.type === 'pivot';

  const canConfirm =
    selectedCard &&
    selectedAction &&
    (
      (selectedAction === 'portfolio' && (!isPivot || pivotSector)) ||
      (selectedAction === 'market' && (selectedCard.type === 'insider_trading' ? selectedZone : (selectedSector && selectedZone))) ||
      (selectedAction === 'opponent' && selectedOpponent && (!isPivot || pivotSector))
    );

  function handleConfirm() {
    if (!canConfirm) return;
    const extra = {};
    if (selectedAction === 'market') { 
      if (selectedCard.type !== 'insider_trading') extra.sector = selectedSector; 
      extra.zone = selectedZone; 
    }
    if (selectedAction === 'opponent') { extra.targetPlayerId = selectedOpponent; }
    if (isPivot && selectedAction !== 'market') extra.pivotSector = pivotSector;
    
    allocateCard(selectedCard.id, selectedAction, extra);
    setSelectedCard(null);
    setSelectedAction(null);
    setSelectedSector(null);
    setSelectedZone(null);
    setSelectedOpponent(null);
    setPivotSector(null);
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
    <div className="rounded-xl border border-yellow-600/50 bg-gray-900/80 p-3 flex flex-col gap-2">
      {/* Step indicator */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm md:text-base font-extrabold text-white">Play {3 - remainingActions.length + 1} of 3</span>
        <span className="text-sm font-medium text-gray-300">Choose a card to play</span>
      </div>

      {/* Cards in hand / Selected Zoomed */}
      {selectedCard ? (
        <div className="flex flex-row items-center justify-center gap-3 w-full">
          {/* Card Side */}
          <div className="flex flex-col items-center shrink-0">
            <Card
              card={selectedCard}
              faceDown={false}
              large
              selected={true}
              onClick={() => { setSelectedCard(null); setSelectedAction(null); setPivotSector(null); }}
            />
            <p className="text-[10px] text-gray-500 italic mt-1">Tap card to unselect</p>
          </div>
          
          {/* Actions / Targets Side */}
          <div className="flex flex-col flex-1 min-w-0 max-h-[200px] overflow-y-auto pr-1">
            {!selectedAction ? (
              <div className="flex flex-col gap-2 w-full justify-center h-full">
                <p className="text-[10px] text-center text-gray-400 leading-tight">Where to play?</p>
                {remainingActions.includes('portfolio') && (
                  <button onClick={() => setSelectedAction('portfolio')} className="rounded-md py-2 px-1 bg-yellow-900/50 border border-yellow-700 text-yellow-300 font-bold text-[11px] uppercase tracking-wider hover:bg-yellow-800/50 shadow-sm truncate">My Portfolio</button>
                )}
                {remainingActions.includes('market') && (
                  <button onClick={() => setSelectedAction('market')} className="rounded-md py-2 px-1 bg-blue-900/50 border border-blue-700 text-blue-300 font-bold text-[11px] uppercase tracking-wider hover:bg-blue-800/50 shadow-sm truncate">The Market</button>
                )}
                {remainingActions.includes('opponent') && (
                  <button onClick={() => setSelectedAction('opponent')} className="rounded-md py-2 px-1 bg-red-900/50 border border-red-700 text-red-300 font-bold text-[11px] uppercase tracking-wider hover:bg-red-800/50 shadow-sm truncate">An Opponent</button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-center justify-between">
                   <span className="text-[10px] text-gray-400">Target</span>
                   <button onClick={() => setSelectedAction(null)} className="text-[10px] text-yellow-400 underline">Change Action</button>
                </div>

                {selectedAction === 'market' && (
                  selectedCard.type === 'insider_trading' ? (
                    <div className="origin-top flex flex-col gap-1 -mx-2 scale-90"><HiddenMarketTargetSelector selectedZone={selectedZone} onSelect={setSelectedZone} /></div>
                  ) : (
                    <div className="origin-top flex flex-col gap-1 -mx-2 scale-90"><MarketTargetSelector selectedSector={selectedSector} selectedZone={selectedZone} cardSector={selectedCard?.type === 'pivot' ? null : selectedCard?.sector} onSelect={(sector, zone) => { setSelectedSector(sector); setSelectedZone(zone); }} /></div>
                  )
                )}

                {selectedAction === 'opponent' && (
                  <div className="origin-top flex flex-col gap-1 -mx-2 scale-90"><OpponentSelector opponents={opponents} selectedId={selectedOpponent} onSelect={setSelectedOpponent} /></div>
                )}

                {isPivot && (selectedAction === 'portfolio' || selectedAction === 'opponent') && (
                  <div className="origin-top flex flex-col gap-1 -mx-2 scale-90"><PivotSectorSelector selectedSector={pivotSector} onSelect={setPivotSector} /></div>
                )}

                {/* Confirm button inside right pane */}
                <button
                  disabled={!canConfirm}
                  onClick={handleConfirm}
                  className={`rounded-lg py-2 mt-1 w-full text-sm font-bold transition-colors shadow-md
                    ${canConfirm
                      ? 'bg-yellow-500 text-black hover:bg-yellow-400 active:bg-yellow-600'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                >
                  Confirm
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2 justify-center">
            {myTurnCards.map((card) => (
              <Card
                key={card.id}
                card={card}
                faceDown={false}
                selected={false}
                onClick={() => { setSelectedCard(card); setPivotSector(null); }}
              />
            ))}
          </div>
          {/* Default disabled confirm button when no card selected to maintain structure consistency */}
          <button
            disabled={true}
            className={`rounded-lg py-2 w-full text-sm font-bold transition-colors bg-gray-700 text-gray-500 cursor-not-allowed`}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

function PivotSectorSelector({ selectedSector, onSelect }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-gray-400 text-center">🔄 Choose which sector this Pivot represents:</p>
      <div className="grid grid-cols-2 gap-1.5">
        {SECTORS.map((sector) => {
          const meta = SECTOR_META[sector];
          const active = selectedSector === sector;
          return (
            <button
              key={sector}
              onClick={() => onSelect(sector)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold border transition-colors
                ${active
                  ? 'border-yellow-400 bg-yellow-900/50 text-yellow-300'
                  : 'border-gray-600 bg-gray-800 text-gray-300 hover:border-gray-400'}`}
              style={active ? {} : { borderColor: meta.color + '55' }}
            >
              <span style={{ color: meta.color }}>■</span> {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MarketTargetSelector({ selectedSector, selectedZone, cardSector, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-400 text-center">Choose sector and zone:</p>
      <div className="grid grid-cols-2 gap-1">
        {SECTORS.map((sector) => {
          const isDisabled = cardSector && sector !== cardSector;
          return (
          <div key={sector} className={`flex flex-col gap-1 transition-opacity ${isDisabled ? 'opacity-30 pointer-events-none' : ''}`}>
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
        )})}
      </div>
    </div>
  );
}

function HiddenMarketTargetSelector({ selectedZone, onSelect }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-gray-400 text-center">Play to Global Insider Market:</p>
      <div className="flex justify-center gap-2">
        <button
          onClick={() => onSelect('bull')}
          className={`rounded-lg px-6 py-3 font-bold border transition-colors ${selectedZone === 'bull' ? 'border-green-400 bg-green-900/50 text-green-300' : 'border-green-700 bg-green-950/40 text-green-400'}`}
        >Global Bull ▲</button>
        <button
          onClick={() => onSelect('bear')}
          className={`rounded-lg px-6 py-3 font-bold border transition-colors ${selectedZone === 'bear' ? 'border-red-400 bg-red-900/50 text-red-300' : 'border-red-700 bg-red-950/40 text-red-400'}`}
        >Global Bear ▼</button>
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
          className="flex-1 rounded-lg py-2 text-[10px] sm:text-xs font-bold bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
        >
          Play as Normal Stock (Skip)
        </button>
      </div>
    </div>
  );
}
