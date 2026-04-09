// server/src/aiPlayer.js
// AI player logic — pure functions that decide card allocations for AI turns.
// Four distinct personality profiles: Hunter, Jess, Mandy, Ruth.

import { SECTORS } from './missions.js';

/**
 * Main entry point: given game state and AI player, returns allocation decisions.
 * Dispatches to the correct AI profile.
 */
export function decideAITurn(state, aiPlayer, turnCards) {
  switch (aiPlayer.profile) {
    case 'jess':  return jessDecision(state, aiPlayer, turnCards);
    case 'mandy': return mandyDecision(state, aiPlayer, turnCards);
    case 'ruth':  return ruthDecision(state, aiPlayer, turnCards);
    default:      return hunterDecision(state, aiPlayer, turnCards); // 'hunter' + fallback
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function expectedScore(card, market) {
  if (!card.sector) return 0;
  return card.value * (market[card.sector]?.index ?? 0);
}

function highestExpected(cards, market) {
  return [...cards].sort((a, b) => {
    const diff = expectedScore(b, market) - expectedScore(a, market);
    if (diff !== 0) return diff;
    if (a.type === 'hostile_takeover') return 1;
    if (b.type === 'hostile_takeover') return -1;
    return 0;
  })[0];
}

function leaderId(state, aiPlayer) {
  const opponents = state.players.filter((p) => p.id !== aiPlayer.id);
  if (!opponents.length) return null;
  return [...opponents].sort((a, b) => b.score - a.score)[0].id;
}

function weakestOpponentId(state, aiPlayer) {
  const opponents = state.players.filter((p) => p.id !== aiPlayer.id);
  if (!opponents.length) return null;
  return [...opponents].sort((a, b) => a.portfolio.length - b.portfolio.length)[0].id;
}

/** Remove highest-value non-regulated card from leader's portfolio. */
function findLeaderPortfolioTarget(state, aiPlayer) {
  const opponents = state.players.filter((p) => p.id !== aiPlayer.id);
  if (!opponents.length) return null;
  const leader = [...opponents].sort((a, b) => b.score - a.score)[0];
  const removable = leader.portfolio.filter(
    (c) => c.type !== 'regulated_asset' && !c.faceDown
  );
  if (!removable.length) return null;
  const target = [...removable].sort((a, b) => b.value - a.value)[0];
  return { location: 'portfolio', playerId: leader.id, cardId: target.id };
}

/** Remove highest-value non-regulated card from anywhere (portfolio then market). */
function findAnyRemovalTarget(state, aiPlayer, preferSector = null) {
  const portfolioTarget = findLeaderPortfolioTarget(state, aiPlayer);
  if (portfolioTarget) return portfolioTarget;

  const sectorsToCheck = preferSector
    ? [preferSector, ...SECTORS.filter((s) => s !== preferSector)]
    : SECTORS;

  for (const sector of sectorsToCheck) {
    for (const zone of ['bull', 'bear']) {
      const removable = state.market[sector][zone].filter(
        (c) => c.type !== 'regulated_asset'
      );
      if (removable.length) {
        const best = [...removable].sort((a, b) => b.value - a.value)[0];
        return { location: 'market', sector, zone, cardId: best.id };
      }
    }
  }
  return null;
}

function bestForPortfolio(cards, market) {
  return [...cards].sort((a, b) => {
    const scoreA = expectedScore(a, market);
    const scoreB = expectedScore(b, market);
    if (scoreB !== scoreA) return scoreB - scoreA;
    if (a.type === 'hostile_takeover') return 1;
    if (b.type === 'hostile_takeover') return -1;
    return 0;
  })[0];
}

function marketDelta(card, sector, zone, market, aiPlayer) {
  const aiCardsInSector = aiPlayer.portfolio.filter((c) => c.sector === sector).length;
  const bullCount = market[sector].bull.reduce((s, c) => s + c.value, 0);
  const bearCount = market[sector].bear.reduce((s, c) => s + c.value, 0);
  const newBull = zone === 'bull' ? bullCount + card.value : bullCount;
  const newBear = zone === 'bear' ? bearCount + card.value : bearCount;
  const newIndex = newBull > newBear ? 1 : newBear > newBull ? -1 : 0;
  const oldIndex = market[sector].index;
  return aiCardsInSector * (newIndex - oldIndex);
}

function bestBullPlacement(cards, market, portfolioCards) {
  let best = null;
  let bestDelta = -Infinity;

  for (const card of cards) {
    const validSectors = (card.type === 'pivot' || !card.sector) ? SECTORS : [card.sector];
    for (const sector of validSectors) {
      const owned = portfolioCards.filter((c) => c.sector === sector).length;
      const bullCount = market[sector].bull.reduce((s, c) => s + c.value, 0);
      const bearCount = market[sector].bear.reduce((s, c) => s + c.value, 0);
      const newBull = bullCount + card.value;
      const newBear = bearCount;
      const newIdx = newBull > newBear ? 1 : newBear > newBull ? -1 : 0;
      const oldIdx = market[sector].index;
      const delta = owned * (newIdx - oldIdx);
      if (delta > bestDelta) { bestDelta = delta; best = { card, sector, zone: 'bull' }; }
    }
  }

  if (!best) {
    const firstCard = cards[0];
    const fallbackSector = (firstCard.type === 'pivot' || !firstCard.sector) ? SECTORS[0] : firstCard.sector;
    return { card: firstCard, sector: fallbackSector, zone: 'bull' };
  }
  return best;
}

// ─── Hunter — Aggressive Disruptor ───────────────────────────────────────────

function hunterDecision(state, aiPlayer, turnCards) {
  const market = state.market;

  const htCard = turnCards.find((c) => c.type === 'hostile_takeover');
  const portfolioCard = htCard ?? highestExpected(turnCards, market);
  const remaining1 = turnCards.filter((c) => c.id !== portfolioCard.id);

  const { card: marketCard, sector: mSector, zone: mZone } =
    hunterMarketPlacement(remaining1, market, state, aiPlayer);
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);

  const opponentCard = remaining2[0];
  const targetPlayerId = leaderId(state, aiPlayer);

  const htPlayed = [portfolioCard, opponentCard].find((c) => c.type === 'hostile_takeover');
  let useHostileTakeover = false;
  let hostileTarget = null;
  if (htPlayed) {
    hostileTarget = findAnyRemovalTarget(state, aiPlayer);
    if (hostileTarget) useHostileTakeover = true;
  }

  return { portfolioCard, marketCard, marketSector: mSector, marketZone: mZone,
           opponentCard, targetPlayerId, useHostileTakeover, hostileTarget };
}

function hunterMarketPlacement(cards, market, state, aiPlayer) {
  const opponentPortfolios = state.players
    .filter((p) => p.id !== aiPlayer.id)
    .flatMap((p) => p.portfolio);

  let best = null;
  let bestScore = -Infinity;

  for (const card of cards) {
    const validSectors = (card.type === 'pivot' || !card.sector) ? SECTORS : [card.sector];
    for (const sector of validSectors) {
      const opponentCount = opponentPortfolios.filter((c) => c.sector === sector).length;
      const bull = market[sector].bull.reduce((s, c) => s + c.value, 0);
      const bear = market[sector].bear.reduce((s, c) => s + c.value, 0);
      const newBear = bear + card.value;
      const newIdx = bull > newBear ? 1 : newBear > bull ? -1 : 0;
      const damage = opponentCount * (market[sector].index - newIdx);
      if (damage > bestScore) {
        bestScore = damage;
        best = { card, sector, zone: 'bear' };
      }
    }
  }

  if (!best) {
    const firstCard = cards[0];
    const fallbackSector = (firstCard.type === 'pivot' || !firstCard.sector) ? SECTORS[0] : firstCard.sector;
    return { card: firstCard, sector: fallbackSector, zone: 'bear' };
  }
  return best;
}

// ─── Jess — Mission-Focused Builder ──────────────────────────────────────────

function jessMissionSector(aiPlayer) {
  const marketMission = aiPlayer.missions?.find((m) => m.missionType === 'market' && m.sector);
  return marketMission?.sector ?? null;
}

function jessDecision(state, aiPlayer, turnCards) {
  const market = state.market;
  const missionSector = jessMissionSector(aiPlayer);

  const missionMatch = missionSector
    ? turnCards.find((c) => c.sector === missionSector && c.type !== 'hostile_takeover')
    : null;
  const portfolioCard = missionMatch ?? highestExpected(
    turnCards.filter((c) => c.type !== 'hostile_takeover'),
    market
  ) ?? highestExpected(turnCards, market);

  const remaining1 = turnCards.filter((c) => c.id !== portfolioCard.id);

  const { card: marketCard, sector: mSector, zone: mZone } =
    bestBullPlacement(remaining1, market, aiPlayer.portfolio);
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);

  const opponentCard = remaining2[0];
  const targetPlayerId = weakestOpponentId(state, aiPlayer);

  const useHostileTakeover = false;
  const hostileTarget = null;

  return { portfolioCard, marketCard, marketSector: mSector, marketZone: mZone,
           opponentCard, targetPlayerId, useHostileTakeover, hostileTarget };
}

// ─── Mandy — Market Chaos Agent ──────────────────────────────────────────────

function mandyTargetSector(market) {
  return [...SECTORS].sort((a, b) => {
    const totalA = market[a].bull.length + market[a].bear.length;
    const totalB = market[b].bull.length + market[b].bear.length;
    return totalB - totalA;
  })[0];
}

function mandyOpponentTarget(state, aiPlayer, targetSector) {
  const opponents = state.players.filter((p) => p.id !== aiPlayer.id);
  if (!opponents.length) return null;
  return [...opponents].sort((a, b) => {
    const aCount = a.portfolio.filter((c) => c.sector === targetSector).length;
    const bCount = b.portfolio.filter((c) => c.sector === targetSector).length;
    return bCount - aCount;
  })[0].id;
}

function mandyDecision(state, aiPlayer, turnCards) {
  const market = state.market;
  const targetSector = mandyTargetSector(market);

  const sectorMatch = turnCards.find((c) => c.sector === targetSector);
  const portfolioCard = sectorMatch ?? highestExpected(turnCards, market);
  const remaining1 = turnCards.filter((c) => c.id !== portfolioCard.id);

  const marketCard = [...remaining1].sort((a, b) => b.value - a.value)[0];
  const mSector = (marketCard.type === 'pivot' || !marketCard.sector) ? targetSector : marketCard.sector;
  const currentIdx = market[mSector].index;
  const mandyZone = currentIdx >= 0 ? 'bear' : 'bull';
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);

  const opponentCard = remaining2[0];
  const targetPlayerId = mandyOpponentTarget(state, aiPlayer, targetSector);

  const htPlayed = [portfolioCard, opponentCard].find((c) => c.type === 'hostile_takeover');
  let useHostileTakeover = false;
  let hostileTarget = null;
  if (htPlayed) {
    hostileTarget = findAnyRemovalTarget(state, aiPlayer, targetSector);
    if (hostileTarget) useHostileTakeover = true;
  }

  return { portfolioCard, marketCard, marketSector: mSector, marketZone: mandyZone,
           opponentCard, targetPlayerId, useHostileTakeover, hostileTarget };
}

// ─── Ruth — Adaptive ─────────────────────────────────────────────────────────

function ruthPosition(state, aiPlayer) {
  const scores = state.players.map((p) => p.score);
  const myScore = aiPlayer.score;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  if (myScore >= maxScore) return 'leading';
  if (myScore < avg) return 'trailing';
  return 'midpack';
}

function ruthDecision(state, aiPlayer, turnCards) {
  const position = ruthPosition(state, aiPlayer);

  if (position === 'trailing') return hunterDecision(state, aiPlayer, turnCards);
  if (position === 'leading') return jessDecision(state, aiPlayer, turnCards);

  return ruthMidpackDecision(state, aiPlayer, turnCards);
}

function ruthMidpackDecision(state, aiPlayer, turnCards) {
  const market = state.market;
  const missionSector = jessMissionSector(aiPlayer);

  const missionMatch = missionSector
    ? turnCards.find((c) => c.sector === missionSector)
    : null;
  const portfolioCard = missionMatch ?? highestExpected(turnCards, market);
  const remaining1 = turnCards.filter((c) => c.id !== portfolioCard.id);

  const { card: marketCard, sector: mSector, zone: mZone } =
    bestBullPlacement(remaining1, market, aiPlayer.portfolio);
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);

  const opponentCard = remaining2[0];
  const targetPlayerId = leaderId(state, aiPlayer);

  const htPlayed = [portfolioCard, opponentCard].find((c) => c.type === 'hostile_takeover');
  let useHostileTakeover = false;
  let hostileTarget = null;
  if (htPlayed) {
    const leaderTarget = findLeaderPortfolioTarget(state, aiPlayer);
    if (leaderTarget) {
      const leader = state.players.find((p) => p.id === leaderId(state, aiPlayer));
      const targetCard = leader?.portfolio.find((c) => c.id === leaderTarget.cardId);
      if (targetCard && targetCard.value >= 2) {
        useHostileTakeover = true;
        hostileTarget = leaderTarget;
      }
    }
  }

  return { portfolioCard, marketCard, marketSector: mSector, marketZone: mZone,
           opponentCard, targetPlayerId, useHostileTakeover, hostileTarget };
}
