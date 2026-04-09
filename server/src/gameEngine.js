// server/src/gameEngine.js
// Pure functions — no I/O, no socket references.

import { v4 as uuidv4 } from 'uuid';
import { assignMissions, evaluateMissions, SECTORS } from './missions.js';

export { SECTORS };

// ─── Card definitions ─────────────────────────────────────────────────────────

const CARD_DEFINITIONS = [
  // share_unit: 4 sectors × 8 = 32
  ...SECTORS.flatMap((sector) =>
    Array.from({ length: 8 }, () => ({ type: 'share_unit', sector, value: 1 }))
  ),
  // regulated_asset: 4 sectors × 4 = 16
  ...SECTORS.flatMap((sector) =>
    Array.from({ length: 4 }, () => ({ type: 'regulated_asset', sector, value: 1 }))
  ),
  // insider_trading: 4 sectors × 4 = 16
  ...SECTORS.flatMap((sector) =>
    Array.from({ length: 4 }, () => ({ type: 'insider_trading', sector, value: 1 }))
  ),
  // strategic_merger: 4 sectors × 3 = 12
  ...SECTORS.flatMap((sector) =>
    Array.from({ length: 3 }, () => ({ type: 'strategic_merger', sector, value: 2 }))
  ),
  // hostile_takeover: 4 sectors × 3 = 12
  ...SECTORS.flatMap((sector) =>
    Array.from({ length: 3 }, () => ({ type: 'hostile_takeover', sector, value: 1 }))
  ),
  // pivot: 4 copies — no fixed sector; player chooses when played
  ...Array.from({ length: 4 }, () => ({ type: 'pivot', sector: null, value: 1 })),
];
// Total: 92 cards

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle(array) {
  const a = [...array];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function touch(state) {
  return { ...state, updatedAt: new Date().toISOString() };
}

function removeTurnCard(state, cardId) {
  return { ...state, turnCards: state.turnCards.filter((id) => id !== cardId) };
}

function addToPortfolio(state, playerId, card) {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId ? { ...p, portfolio: [...p.portfolio, card] } : p
    ),
  };
}

function addToMarket(state, sector, zone, card) {
  return {
    ...state,
    market: {
      ...state.market,
      [sector]: {
        ...state.market[sector],
        [zone]: [...state.market[sector][zone], card],
      },
    },
  };
}

// ─── Deck ─────────────────────────────────────────────────────────────────────

export function createDeck() {
  return shuffle(
    CARD_DEFINITIONS.map((def) => ({
      id: uuidv4(),
      type: def.type,
      sector: def.sector,
      value: def.value,
      faceDown: def.type === 'insider_trading',
    }))
  );
}

// ─── Initial state ────────────────────────────────────────────────────────────

/**
 * Creates fresh game state.
 * @param {string} gameId
 * @param {{ id, telegramId, name, socketId }[]} players
 */
export function createInitialState(gameId, players) {
  const deck = createDeck();
  const basePlayers = players.map((p) => ({
    ...p,
    portfolio: [],
    score: 0,
    connected: true,
    missions: [],
  }));
  const playersWithMissions = assignMissions(basePlayers);

  return touch({
    gameId,
    phase: 'playing',
    currentPlayerIndex: 0,
    remainingActions: ['portfolio', 'market', 'opponent'],
    turnCards: [],
    pendingHostileTakeover: null,
    _turnCardMap: {},
    deck,
    players: playersWithMissions,
    market: Object.fromEntries(SECTORS.map((s) => [s, { bull: [], bear: [], index: 0 }])),
    unrevealedMarket: { bull: [], bear: [] },
    scores: [],
    winnerId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

// ─── Turn management ──────────────────────────────────────────────────────────

/**
 * Draws 3 cards for the current player and starts their turn.
 * If the deck is empty, triggers reveal phase instead.
 * @returns {{ state: GameState, drawnCards: Card[] }}
 */
export function startTurn(state) {
  if (state.deck.length === 0) {
    return { state: triggerReveal(state), drawnCards: [] };
  }

  const count = Math.min(3, state.deck.length);
  const drawnCards = state.deck.slice(0, count);
  const newDeck = state.deck.slice(count);

  const newState = touch({
    ...state,
    deck: newDeck,
    turnCards: drawnCards.map((c) => c.id),
    remainingActions: ['portfolio', 'market', 'opponent'],
    pendingHostileTakeover: null,
    _turnCardMap: Object.fromEntries(drawnCards.map((c) => [c.id, c])),
  });

  return { state: newState, drawnCards };
}

// ─── Card allocation ──────────────────────────────────────────────────────────

/**
 * Validates and applies one allocation step.
 *
 * @param {GameState} state
 * @param {string} playerId
 * @param {string} cardId
 * @param {'portfolio'|'market'|'opponent'} step
 * @param {{ sector?: string, zone?: 'bull'|'bear', targetPlayerId?: string }} extra
 * @returns {{ state: GameState, error?: string, activateAbility?: boolean }}
 */
export function allocateCard(state, playerId, cardId, step, extra = {}) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) return { state, error: 'Not your turn' };
  if (!state.turnCards.includes(cardId)) return { state, error: 'Card not in hand' };
  if (!state.remainingActions.includes(step)) {
    return { state, error: `Action ${step} already used or invalid` };
  }

  let card = state._turnCardMap[cardId];
  if (!card) return { state, error: 'Card data not found' };

  // ── Pivot sector resolution ──────────────────────────────────────────────
  // Pivot cards have no fixed sector; the sector is chosen at play time.
  // For market placement, the sector is implicit from the chosen zone.
  // For portfolio / opponent placement, the player must supply pivotSector.
  if (card.type === 'pivot') {
    if (step === 'market') {
      if (!SECTORS.includes(extra.sector)) return { state, error: 'Invalid sector for Pivot card' };
      card = { ...card, sector: extra.sector };
    } else {
      if (!SECTORS.includes(extra.pivotSector)) {
        return { state, error: 'Pivot card requires a sector selection (pivotSector)' };
      }
      card = { ...card, sector: extra.pivotSector };
    }
  }

  let newState = removeTurnCard(state, cardId);
  const nextActions = state.remainingActions.filter((a) => a !== step);
  let activateAbility = false;

  if (step === 'portfolio') {
    newState = addToPortfolio(newState, currentPlayer.id, card);
    if (card.type === 'hostile_takeover') activateAbility = true;
  } else if (step === 'market') {
    const { sector, zone } = extra;
    if (card.type === 'insider_trading') {
      if (!['bull', 'bear'].includes(zone)) return { state, error: 'Invalid zone (bull or bear)' };
      newState = {
        ...newState,
        unrevealedMarket: {
          ...newState.unrevealedMarket,
          [zone]: [...newState.unrevealedMarket[zone], card],
        },
      };
    } else {
      if (!SECTORS.includes(sector)) return { state, error: 'Invalid sector' };
      if (!['bull', 'bear'].includes(zone)) return { state, error: 'Invalid zone (bull or bear)' };
      newState = addToMarket(newState, sector, zone, card);
    }
  } else if (step === 'opponent') {
    const { targetPlayerId } = extra;
    const target = newState.players.find((p) => p.id === targetPlayerId);
    if (!target) return { state, error: 'Target player not found' };
    if (target.id === currentPlayer.id) return { state, error: 'Cannot target yourself for opponent slot' };
    newState = addToPortfolio(newState, targetPlayerId, card);
    if (card.type === 'hostile_takeover') activateAbility = true;
  } else {
    return { state, error: 'Invalid step' };
  }

  newState.remainingActions = nextActions;
  return { state: touch(newState), activateAbility };
}

// ─── Hostile Takeover ─────────────────────────────────────────────────────────

/**
 * Removes a non-regulated card from any portfolio or market zone.
 *
 * @param {GameState} state
 * @param {string} playerId
 * @param {{ location: 'portfolio'|'market', cardId: string,
 *            playerId?: string, sector?: string, zone?: 'bull'|'bear' }} target
 * @returns {{ state: GameState, error?: string, removedCard?: Card }}
 */
export function activateHostileTakeover(state, playerId, target) {
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== playerId) return { state, error: 'Not your turn' };

  const { location, cardId } = target;

  if (location === 'portfolio') {
    const owner = state.players.find((p) => p.id === target.playerId);
    if (!owner) return { state, error: 'Target player not found' };
    const card = owner.portfolio.find((c) => c.id === cardId);
    if (!card) return { state, error: 'Card not in portfolio' };
    if (card.type === 'regulated_asset') return { state, error: 'Cannot remove a Regulated Asset' };

    const newPlayers = state.players.map((p) =>
      p.id === owner.id ? { ...p, portfolio: p.portfolio.filter((c) => c.id !== cardId) } : p
    );
    return { state: touch({ ...state, players: newPlayers }), removedCard: card };
  }

  if (location === 'market') {
    const { sector, zone } = target;
    if (!SECTORS.includes(sector)) return { state, error: 'Invalid sector' };
    if (!['bull', 'bear'].includes(zone)) return { state, error: 'Invalid zone' };

    const zoneCards = state.market[sector][zone];
    const card = zoneCards.find((c) => c.id === cardId);
    if (!card) return { state, error: 'Card not in market zone' };
    if (card.type === 'regulated_asset') return { state, error: 'Cannot remove a Regulated Asset' };

    const newMarket = {
      ...state.market,
      [sector]: {
        ...state.market[sector],
        [zone]: zoneCards.filter((c) => c.id !== cardId),
      },
    };
    return { state: touch({ ...state, market: newMarket }), removedCard: card };
  }

  return { state, error: 'Invalid target location' };
}

// ─── Turn advancement ─────────────────────────────────────────────────────────

export function endTurn(state) {
  if (state.deck.length === 0 && state.turnCards.length === 0) {
    return triggerReveal(state);
  }

  const nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  return touch({
    ...state,
    currentPlayerIndex: nextIndex,
    remainingActions: ['portfolio', 'market', 'opponent'],
    turnCards: [],
    pendingHostileTakeover: null,
    _turnCardMap: {},
  });
}

// ─── Reveal phase ─────────────────────────────────────────────────────────────

function triggerReveal(state) {
  return touch({ ...state, phase: 'reveal', turnCards: [], _turnCardMap: {} });
}

export function revealInsiderTrading(state) {
  const players = state.players.map((p) => ({
    ...p,
    portfolio: p.portfolio.map((c) =>
      c.type === 'insider_trading' ? { ...c, faceDown: false } : c
    ),
  }));

  const market = { ...state.market };
  for (const zone of ['bull', 'bear']) {
    for (const card of state.unrevealedMarket.zone || state.unrevealedMarket[zone] || []) {
      const sector = card.sector;
      market[sector] = {
        ...market[sector],
        [zone]: [...market[sector][zone], { ...card, faceDown: false }],
      };
    }
  }

  return touch({ ...state, players, market, unrevealedMarket: { bull: [], bear: [] }, phase: 'scoring' });
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

export function calculateScores(state) {
  // Step 1: compute sector indices
  const market = Object.fromEntries(
    SECTORS.map((sector) => {
      const bullTotal = state.market[sector].bull.reduce((s, c) => s + c.value, 0);
      const bearTotal = state.market[sector].bear.reduce((s, c) => s + c.value, 0);
      return [
        sector,
        {
          ...state.market[sector],
          index: bullTotal > bearTotal ? 1 : bearTotal > bullTotal ? -1 : 0,
        },
      ];
    })
  );

  // Step 2: base scores (skip cards with no resolved sector — shouldn't happen)
  let players = state.players.map((p) => {
    const baseScore = p.portfolio.reduce((total, card) => {
      if (!card.sector || !market[card.sector]) return total;
      return total + card.value * market[card.sector].index;
    }, 0);
    return { ...p, score: baseScore };
  });

  // Step 3: evaluate missions and add bonus points
  players = evaluateMissions(players, market);
  players = players.map((p) => {
    const missionBonus = p.missions.reduce((sum, m) => sum + m.bonusPoints, 0);
    return { ...p, score: p.score + missionBonus };
  });

  // Step 4: build scores summary
  const maxScore = Math.max(...players.map((p) => p.score));
  const scores = players.map((p) => ({
    playerId: p.id,
    name: p.name,
    score: p.score,
    isWinner: p.score === maxScore,
    missions: p.missions,
    sectorBreakdown: SECTORS.map((sector) => ({
      sector,
      index: market[sector].index,
      cards: p.portfolio.filter((c) => c.sector === sector),
      contribution: p.portfolio
        .filter((c) => c.sector === sector)
        .reduce((s, c) => s + c.value * market[sector].index, 0),
    })),
  }));

  const winners = players.filter((p) => p.score === maxScore);

  return touch({
    ...state,
    market,
    players,
    scores,
    winnerId: winners.length === 1 ? winners[0].id : null,
    phase: 'finished',
  });
}

// ─── Serialization ────────────────────────────────────────────────────────────

/**
 * Returns a state safe to send to a specific player.
 * - Strips server-only _turnCardMap
 * - Masks opponents' face-down insider_trading cards
 * - Masks opponents' face-down mission cards
 */
export function serializeForPlayer(state, viewingPlayerId) {
  const { _turnCardMap, ...publicState } = state;

  const players = publicState.players.map((p) => {
    const isViewer = p.id === viewingPlayerId;
    return {
      ...p,
      portfolio: p.portfolio.map((c) => {
        if (!isViewer && c.faceDown && c.type === 'insider_trading') {
          return { id: c.id, sector: c.sector, value: 1, faceDown: true, type: 'hidden' };
        }
        return c;
      }),
      missions: p.missions.map((m) => {
        if (!isViewer && m.faceDown) {
          return { id: m.id, missionType: m.missionType, faceDown: true };
        }
        return m;
      }),
    };
  });

  if (publicState.unrevealedMarket) {
    publicState.unrevealedMarket = {
      bull: publicState.unrevealedMarket.bull.map(c => ({ id: c.id, faceDown: true, type: 'hidden' })),
      bear: publicState.unrevealedMarket.bear.map(c => ({ id: c.id, faceDown: true, type: 'hidden' }))
    };
  }

  return { ...publicState, players };
}
