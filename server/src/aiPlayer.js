// server/src/aiPlayer.js
// AI player logic — pure functions that decide card allocations for AI turns.
// Strategy: greedy but reasonable. Picks allocations that maximise own score
// and minimise the current leader's advantage.
// AI player logic — 4 distinct personality profiles.
// All functions are pure (no I/O) and return the same decision shape.
 
import { SECTORS } from './missions.js';
 
// ─── Main entry point ─────────────────────────────────────────────────────────
// ─── Public API ───────────────────────────────────────────────────────────────
 
/**
 * Given the current game state and an AI player, returns the three allocation
 * decisions for this turn.
 * Dispatch to the correct AI profile.
 *
 * @param {GameState} state
 * @param {Player}    aiPlayer
 * @param {Card[]}    turnCards  — the 3 cards drawn this turn
 * @param {Player}    aiPlayer  — must have a `.profile` field ('hunter'|'jess'|'mandy'|'ruth')
 * @param {Card[]}    turnCards — the 3 cards drawn this turn
 * @returns {{
 *   portfolioCard:  { card: Card },
 *   marketCard:     { card: Card, sector: string, zone: 'bull'|'bear' },
 *   opponentCard:   { card: Card, targetPlayerId: string },
 *   portfolioCard:  Card,
 *   marketCard:     Card,
 *   marketSector:   string,
 *   marketZone:     'bull'|'bear',
 *   opponentCard:   Card,
 *   targetPlayerId: string|null,
 *   useHostileTakeover: boolean,
 *   hostileTarget?: object,
 * }}
 */
export function decideAITurn(state, aiPlayer, turnCards) {
  const market = state.market;
  const humanPlayers = state.players.filter((p) => !p.isAI && p.id !== aiPlayer.id);
  const allOpponents  = state.players.filter((p) => p.id !== aiPlayer.id);
  switch (aiPlayer.profile) {
    case 'jess':  return jessDecision(state, aiPlayer, turnCards);
    case 'mandy': return mandyDecision(state, aiPlayer, turnCards);
    case 'ruth':  return ruthDecision(state, aiPlayer, turnCards);
    default:      return hunterDecision(state, aiPlayer, turnCards); // 'hunter' + fallback
  }
}
 
  // ── Step 1: choose portfolio card ────────────────────────────────────────
  // Score each card by card.value × market[sector].index
  // Prefer highest expected score; break ties by favouring hostile_takeover last
  const portfolioCard = bestForPortfolio(turnCards, market);
  const remaining1    = turnCards.filter((c) => c.id !== portfolioCard.id);
// ─── Shared helpers ───────────────────────────────────────────────────────────
 
  // ── Step 2: choose market card + placement ───────────────────────────────
  const { card: marketCard, sector: mSector, zone: mZone } =
    bestForMarket(remaining1, market, aiPlayer);
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);
function expectedScore(card, market) {
  if (!card.sector) return 0;
  return card.value * (market[card.sector]?.index ?? 0);
}
 
  // ── Step 3: choose opponent card + target ───────────────────────────────
  const opponentCard = remaining2[0]; // only one left
  const targetPlayerId = weakestOpponent(allOpponents, opponentCard);
/** Highest-expected-score card from a list; breaks ties by deprioritising hostile_takeover */
function highestExpected(cards, market) {
  return [...cards].sort((a, b) => {
    const diff = expectedScore(b, market) - expectedScore(a, market);
    if (diff !== 0) return diff;
    if (a.type === 'hostile_takeover') return 1;
    if (b.type === 'hostile_takeover') return -1;
    return 0;
  })[0];
}
 
  // ── Hostile takeover: should the AI activate it? ─────────────────────────
  // Activate if we played a hostile_takeover to portfolio or opponent slot
  // AND there's a high-value non-regulated card we can remove from the leader
  let useHostileTakeover = false;
  let hostileTarget      = null;
/** (card, sector, zone) combo that maximises own_portfolio_cards × index_improvement */
function bestBullPlacement(cards, market, portfolioCards) {
  let best = null;
  let bestDelta = -Infinity;
 
  const htCard = [portfolioCard, opponentCard].find((c) => c.type === 'hostile_takeover');
  if (htCard) {
    const best = findBestRemovalTarget(state, aiPlayer);
    if (best) { useHostileTakeover = true; hostileTarget = best; }
  for (const card of cards) {
    for (const sector of SECTORS) {
      for (const zone of ['bull', 'bear']) {
        const owned = portfolioCards.filter((c) => c.sector === sector).length;
        const bull  = market[sector].bull.reduce((s, c) => s + c.value, 0);
        const bear  = market[sector].bear.reduce((s, c) => s + c.value, 0);
        const newBull = zone === 'bull' ? bull + card.value : bull;
        const newBear = zone === 'bear' ? bear + card.value : bear;
        const oldIdx  = market[sector].index;
        const newIdx  = newBull > newBear ? 1 : newBear > newBull ? -1 : 0;
        const delta   = owned * (newIdx - oldIdx);
        if (delta > bestDelta) { bestDelta = delta; best = { card, sector, zone }; }
      }
    }
  }
 
  return {
    portfolioCard,
    marketCard, marketSector: mSector, marketZone: mZone,
    opponentCard, targetPlayerId,
    useHostileTakeover, hostileTarget,
  };
  if (!best) return { card: cards[0], sector: SECTORS[0], zone: 'bull' };
  return best;
}
 
// ─── Portfolio selection ──────────────────────────────────────────────────────
/** Remove the highest-value non-regulated card from the leader's portfolio. */
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
 
function bestForPortfolio(cards, market) {
  return [...cards].sort((a, b) => {
    const scoreA = expectedScore(a, market);
    const scoreB = expectedScore(b, market);
    if (scoreB !== scoreA) return scoreB - scoreA;
    // Deprioritise hostile_takeover for own portfolio (use it for removal instead)
    if (a.type === 'hostile_takeover') return 1;
    if (b.type === 'hostile_takeover') return -1;
    return 0;
  })[0];
/** Remove the highest-value non-regulated card from anywhere (portfolio then market). */
function findAnyRemovalTarget(state, aiPlayer, preferSector = null) {
  // Try leader's portfolio first
  const portfolioTarget = findLeaderPortfolioTarget(state, aiPlayer);
  if (portfolioTarget) return portfolioTarget;
 
  // Try market — prefer a specific sector if provided
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
 
function expectedScore(card, market) {
  if (!card.sector) return 0; // pivot with no sector yet — treat as neutral
  const idx = market[card.sector]?.index ?? 0;
  return card.value * idx;
/** Player ID of the opponent with the highest score. */
function leaderId(state, aiPlayer) {
  const opponents = state.players.filter((p) => p.id !== aiPlayer.id);
  if (!opponents.length) return null;
  return [...opponents].sort((a, b) => b.score - a.score)[0].id;
}
 
// ─── Market placement ─────────────────────────────────────────────────────────
/** Player ID of the opponent with the fewest portfolio cards (least threat). */
function weakestOpponentId(state, aiPlayer) {
  const opponents = state.players.filter((p) => p.id !== aiPlayer.id);
  if (!opponents.length) return null;
  return [...opponents].sort((a, b) => a.portfolio.length - b.portfolio.length)[0].id;
}
 
// ─── Hunter — Aggressive Disruptor ───────────────────────────────────────────
//
// Keeps hostile_takeover cards for the removal ability.
// Pushes Bear into sectors where opponents hold the most cards.
// Always targets the leader with both opponent-card and Hostile Takeover.
 
function hunterDecision(state, aiPlayer, turnCards) {
  const market = state.market;
 
function bestForMarket(cards, market, aiPlayer) {
  // Find the (card, sector, zone) combo that gives the AI the best index swing.
  // Simplified: for each card, find the sector/zone that either:
  //   (a) reinforces a sector where AI has portfolio cards → push index toward +1
  //   (b) hurts a sector where AI has NO portfolio cards → push index toward -1 (irrelevant)
  // Fall back to bull placement in sector with fewest bull cards (balance the market).
  // ── Portfolio: save hostile_takeover for removal; otherwise highest expected ──
  const htCard = turnCards.find((c) => c.type === 'hostile_takeover');
  const portfolioCard = htCard ?? highestExpected(turnCards, market);
  const remaining1 = turnCards.filter((c) => c.id !== portfolioCard.id);
 
  // ── Market: push Bear into the sector where opponents hold most cards ──────
  const { card: marketCard, sector: mSector, zone: mZone } =
    hunterMarketPlacement(remaining1, market, state, aiPlayer);
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);
 
  // ── Opponent: send remaining card to leader ────────────────────────────────
  const opponentCard = remaining2[0];
  const targetPlayerId = leaderId(state, aiPlayer);
 
  // ── Hostile Takeover: always activate if possible ─────────────────────────
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
  // Find sector where opponents (non-AI included) hold the most portfolio cards
  const opponentPortfolios = state.players
    .filter((p) => p.id !== aiPlayer.id)
    .flatMap((p) => p.portfolio);
 
  let best = null;
  let bestDelta = -Infinity;
  let bestScore = -Infinity;
 
  for (const card of cards) {
    for (const sector of SECTORS) {
      for (const zone of ['bull', 'bear']) {
        const delta = marketDelta(card, sector, zone, market, aiPlayer);
        if (delta > bestDelta) {
          bestDelta = delta;
          best = { card, sector, zone };
        }
      // Count how many opponent cards are in this sector
      const opponentCount = opponentPortfolios.filter((c) => c.sector === sector).length;
      // Simulate placing Bear to see if index goes negative
      const bull = market[sector].bull.reduce((s, c) => s + c.value, 0);
      const bear = market[sector].bear.reduce((s, c) => s + c.value, 0);
      const newBear = bear + card.value;
      const newIdx = bull > newBear ? 1 : newBear > bull ? -1 : 0;
      const damage = opponentCount * (market[sector].index - newIdx); // positive = hurts them
      if (damage > bestScore) {
        bestScore = damage;
        best = { card, sector, zone: 'bear' };
      }
    }
  }
 
  // Fallback — shouldn't happen
  if (!best) {
    const card = cards[0];
    return { card, sector: SECTORS[0], zone: 'bull' };
  }
  if (!best) return { card: cards[0], sector: SECTORS[0], zone: 'bear' };
  return best;
}
 
function marketDelta(card, sector, zone, market, aiPlayer) {
  const aiCardsInSector = aiPlayer.portfolio.filter((c) => c.sector === sector).length;
  const bullCount = market[sector].bull.reduce((s, c) => s + c.value, 0);
  const bearCount = market[sector].bear.reduce((s, c) => s + c.value, 0);
// ─── Jess — Mission-Focused Builder ──────────────────────────────────────────
//
// Concentrates on own portfolio sectors; places Bull to improve own score.
// Sends the lowest-value card to the weakest opponent.
// Skips Hostile Takeover activation (avoids disruption, stays clean).
 
function jessDecision(state, aiPlayer, turnCards) {
  const market = state.market;
 
  // Determine Jess's mission sector (market mission sector, if assigned)
  const missionSector = jessMissionSector(aiPlayer);
 
  // ── Portfolio: prefer mission sector; otherwise highest expected ──────────
  const missionMatch = missionSector
    ? turnCards.find((c) => c.sector === missionSector && c.type !== 'hostile_takeover')
    : null;
  const portfolioCard = missionMatch ?? highestExpected(
    turnCards.filter((c) => c.type !== 'hostile_takeover'),
    market
  ) ?? highestExpected(turnCards, market);
 
  const remaining1 = turnCards.filter((c) => c.id !== portfolioCard.id);
 
  // ── Market: Bull in sector where Jess already has portfolio cards ─────────
  const { card: marketCard, sector: mSector, zone: mZone } =
    bestBullPlacement(remaining1, market, aiPlayer.portfolio);
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);
 
  // Simulate placing the card
  const newBull = zone === 'bull' ? bullCount + card.value : bullCount;
  const newBear = zone === 'bear' ? bearCount + card.value : bearCount;
  const newIndex = newBull > newBear ? 1 : newBear > newBull ? -1 : 0;
  const oldIndex = market[sector].index;
  // ── Opponent: lowest-value remaining card → weakest opponent ─────────────
  const opponentCard = remaining2[0];
  const targetPlayerId = weakestOpponentId(state, aiPlayer);
 
  // Score improvement = AI's cards in sector × index change
  const indexDelta = newIndex - oldIndex;
  return aiCardsInSector * indexDelta;
  // ── Hostile Takeover: skip activation to avoid `the_regulator` conflicts ──
  const useHostileTakeover = false;
  const hostileTarget = null;
 
  return { portfolioCard, marketCard, marketSector: mSector, marketZone: mZone,
           opponentCard, targetPlayerId, useHostileTakeover, hostileTarget };
}
 
// ─── Opponent selection ───────────────────────────────────────────────────────
/** Return the sector of Jess's market mission, or null if not found. */
function jessMissionSector(aiPlayer) {
  const marketMission = aiPlayer.missions?.find((m) => m.missionType === 'market' && m.sector);
  return marketMission?.sector ?? null;
}
 
// ─── Mandy — Market Chaos Agent ──────────────────────────────────────────────
//
// Picks a "target sector" (most cards in play) and aggressively destabilises it.
// Flips the index opposite to its current direction each turn.
// Uses Hostile Takeover to remove market cards in target sector.
 
function mandyDecision(state, aiPlayer, turnCards) {
  const market = state.market;
 
function weakestOpponent(opponents, card) {
  if (opponents.length === 0) return null;
  // ── Determine target sector: most combined bull+bear cards ────────────────
  const targetSector = mandyTargetSector(market);
 
  // ── Portfolio: prefer a card matching target sector ───────────────────────
  const sectorMatch = turnCards.find((c) => c.sector === targetSector);
  const portfolioCard = sectorMatch ?? highestExpected(turnCards, market);
  const remaining1 = turnCards.filter((c) => c.id !== portfolioCard.id);
 
  // ── Market: place in target sector, opposite of current index ─────────────
  const currentIdx = market[targetSector].index;
  // If +1 → push Bear; if -1 → push Bull; if 0 → push Bear (default disrupt)
  const mandyZone = currentIdx >= 0 ? 'bear' : 'bull';
  // Pick card from remaining that maximises chaos in target sector
  const marketCard = [...remaining1].sort((a, b) => b.value - a.value)[0];
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);
 
  // ── Opponent: target the player with most cards in target sector ──────────
  const opponentCard = remaining2[0];
  const targetPlayerId = mandyOpponentTarget(state, aiPlayer, targetSector);
 
  // ── Hostile Takeover: remove a market card in the target sector ───────────
  const htPlayed = [portfolioCard, opponentCard].find((c) => c.type === 'hostile_takeover');
  let useHostileTakeover = false;
  let hostileTarget = null;
  if (htPlayed) {
    hostileTarget = findAnyRemovalTarget(state, aiPlayer, targetSector);
    if (hostileTarget) useHostileTakeover = true;
  }
 
  // Send hostile_takeover to the leader (highest score)
  // Send low-value cards to the leader too (to load their portfolio with junk)
  const sorted = [...opponents].sort((a, b) => b.score - a.score);
  return sorted[0].id;
  return { portfolioCard, marketCard, marketSector: targetSector, marketZone: mandyZone,
           opponentCard, targetPlayerId, useHostileTakeover, hostileTarget };
}
 
// ─── Hostile takeover targeting ───────────────────────────────────────────────
function mandyTargetSector(market) {
  return [...SECTORS].sort((a, b) => {
    const totalA = market[a].bull.length + market[a].bear.length;
    const totalB = market[b].bull.length + market[b].bear.length;
    return totalB - totalA; // most cards first; alphabetical tie-break via stable sort
  })[0];
}
 
function findBestRemovalTarget(state, aiPlayer) {
  // Find the non-regulated card with highest value belonging to the current leader
function mandyOpponentTarget(state, aiPlayer, targetSector) {
  const opponents = state.players.filter((p) => p.id !== aiPlayer.id);
  if (opponents.length === 0) return null;
  if (!opponents.length) return null;
  return [...opponents].sort((a, b) => {
    const aCount = a.portfolio.filter((c) => c.sector === targetSector).length;
    const bCount = b.portfolio.filter((c) => c.sector === targetSector).length;
    return bCount - aCount;
  })[0].id;
}
 
  const leader = [...opponents].sort((a, b) => b.score - a.score)[0];
// ─── Ruth — Adaptive ─────────────────────────────────────────────────────────
//
// Reads own standing and delegates:
//   Trailing  → Hunter (aggressive)
//   Leading   → Jess   (defensive, protect lead)
//   Mid-pack  → balanced mission-aware play
 
  // Look for removable cards in leader's portfolio
  const removable = leader.portfolio.filter(
    (c) => c.type !== 'regulated_asset' && !c.faceDown
  );
  if (removable.length === 0) {
    // Try market — find highest-value card in a sector hurting AI
    for (const sector of SECTORS) {
      for (const zone of ['bull', 'bear']) {
        const marketRemovable = state.market[sector][zone].filter(
          (c) => c.type !== 'regulated_asset'
        );
        if (marketRemovable.length > 0) {
          const best = [...marketRemovable].sort((a, b) => b.value - a.value)[0];
          return { location: 'market', sector, zone, cardId: best.id };
        }
function ruthDecision(state, aiPlayer, turnCards) {
  const position = ruthPosition(state, aiPlayer);
 
  if (position === 'trailing') return hunterDecision(state, aiPlayer, turnCards);
  if (position === 'leading')  return jessDecision(state, aiPlayer, turnCards);
 
  // Mid-pack: balanced approach
  return ruthMidpackDecision(state, aiPlayer, turnCards);
}
 
function ruthPosition(state, aiPlayer) {
  const scores = state.players.map((p) => p.score);
  const myScore = aiPlayer.score;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxScore = Math.max(...scores);
  if (myScore >= maxScore) return 'leading';
  if (myScore < avg)       return 'trailing';
  return 'midpack';
}
 
function ruthMidpackDecision(state, aiPlayer, turnCards) {
  const market = state.market;
 
  // Portfolio: mission sector first, then highest expected
  const missionSector = jessMissionSector(aiPlayer); // reuse Jess's mission lookup
  const missionMatch = missionSector
    ? turnCards.find((c) => c.sector === missionSector)
    : null;
  const portfolioCard = missionMatch ?? highestExpected(turnCards, market);
  const remaining1 = turnCards.filter((c) => c.id !== portfolioCard.id);
 
  // Market: best bull placement for self
  const { card: marketCard, sector: mSector, zone: mZone } =
    bestBullPlacement(remaining1, market, aiPlayer.portfolio);
  const remaining2 = remaining1.filter((c) => c.id !== marketCard.id);
 
  // Opponent: send remaining card to leader
  const opponentCard = remaining2[0];
  const targetPlayerId = leaderId(state, aiPlayer);
 
  // Hostile Takeover: activate only if leader has a card worth ≥ 2
  const htPlayed = [portfolioCard, opponentCard].find((c) => c.type === 'hostile_takeover');
  let useHostileTakeover = false;
  let hostileTarget = null;
  if (htPlayed) {
    const leaderTarget = findLeaderPortfolioTarget(state, aiPlayer);
    if (leaderTarget) {
      // Check that the target card is valuable enough to bother
      const leader = state.players.find((p) =>
        p.id === state.players.filter((pl) => pl.id !== aiPlayer.id)
          .sort((a, b) => b.score - a.score)[0]?.id
      );
      const targetCard = leader?.portfolio.find((c) => c.id === leaderTarget.cardId);
      if (targetCard && targetCard.value >= 2) {
        useHostileTakeover = true;
        hostileTarget = leaderTarget;
      }
    }
    return null;
  }
 
  const target = [...removable].sort((a, b) => b.value - a.value)[0];
  return { location: 'portfolio', playerId: leader.id, cardId: target.id };
  return { portfolioCard, marketCard, marketSector: mSector, marketZone: mZone,
           opponentCard, targetPlayerId, useHostileTakeover, hostileTarget };
}
