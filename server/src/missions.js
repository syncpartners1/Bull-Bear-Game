// server/src/missions.js
// Mission registry and evaluation logic.

export const SECTORS = ['tech', 'finance', 'energy', 'pharma'];

// ─── Mission definitions ─────────────────────────────────────────────────────

export const MARKET_MISSIONS = [
  {
    id: 'tech_analyst',
    name: 'Tech Analyst',
    missionType: 'market',
    sector: 'tech',
    description: 'Accumulate more Tech cards in your portfolio than anyone else.',
    bonusLabel: '+1 pt per Tech card',
  },
  {
    id: 'energy_analyst',
    name: 'Energy Analyst',
    missionType: 'market',
    sector: 'energy',
    description: 'Accumulate more Energy cards in your portfolio than anyone else.',
    bonusLabel: '+1 pt per Energy card',
  },
  {
    id: 'investment_banker',
    name: 'Investment Banker',
    missionType: 'market',
    sector: 'finance',
    description: 'Accumulate more Finance cards in your portfolio than anyone else.',
    bonusLabel: '+1 pt per Finance card',
  },
  {
    id: 'pharma_investor',
    name: 'Pharma Investor',
    missionType: 'market',
    sector: 'pharma',
    description: 'Accumulate more Pharma cards in your portfolio than anyone else.',
    bonusLabel: '+1 pt per Pharma card',
  },
];

export const STRATEGY_MISSIONS = [
  {
    id: 'balanced_portfolio',
    name: 'Balanced Portfolio',
    missionType: 'strategy',
    description: 'Hold at least one card from each of the 4 sectors in your portfolio.',
    bonusLabel: '+5 pts',
    fixedBonus: 5,
  },
  {
    id: 'big_short',
    name: 'Big Short',
    missionType: 'strategy',
    description:
      'Hold the most cards from the sector that collapsed the most (most negative index). No bonus if no sector is negative.',
    bonusLabel: '+4 pts',
    fixedBonus: 4,
  },
  {
    id: 'top_record',
    name: 'Top Record',
    missionType: 'strategy',
    description:
      'Hold the most cards from the sector that traded highest (most positive index). No bonus if no sector is positive.',
    bonusLabel: '+3 pts',
    fixedBonus: 3,
  },
  {
    id: 'fixer',
    name: 'Fixer',
    missionType: 'strategy',
    description: 'Ensure exactly 2 markets are Bull and 2 are Bear at the end of the game.',
    bonusLabel: '+5 pts',
    fixedBonus: 5,
  },
  {
    id: 'the_regulator',
    name: 'The Regulator',
    missionType: 'strategy',
    description: 'Finish the game with zero Hostile Takeover cards in your portfolio.',
    bonusLabel: '+4 pts',
    fixedBonus: 4,
  },
  {
    id: 'full_liquidity',
    name: 'Full Liquidity',
    missionType: 'strategy',
    description: 'Ensure no market is balanced (index = 0) at the end of the game.',
    bonusLabel: '+4 pts',
    fixedBonus: 4,
  },
];

// ─── Assignment ──────────────────────────────────────────────────────────────

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Assigns 1 market mission + 1 strategy mission to each player.
 * If there are more players than missions in a pool, the pool cycles.
 * Returns updated players array with `missions` field added.
 */
export function assignMissions(players) {
  const marketPool = shuffleArray(MARKET_MISSIONS);
  const strategyPool = shuffleArray(STRATEGY_MISSIONS);

  return players.map((player, idx) => {
    const marketDef = marketPool[idx % marketPool.length];
    const strategyDef = strategyPool[idx % strategyPool.length];

    const makeMission = (def) => ({
      id: def.id,
      name: def.name,
      missionType: def.missionType,
      sector: def.sector || null,
      description: def.description,
      bonusLabel: def.bonusLabel,
      fixedBonus: def.fixedBonus || null,
      faceDown: true,
      achieved: false,
      bonusPoints: 0,
    });

    return {
      ...player,
      missions: [makeMission(marketDef), makeMission(strategyDef)],
    };
  });
}

// ─── Evaluation ──────────────────────────────────────────────────────────────

/**
 * Evaluates all missions for all players after final sector indices are set.
 * Returns updated players[] with mission.achieved and mission.bonusPoints filled in.
 */
export function evaluateMissions(players, market) {
  // Pre-compute sector card counts per player for Market missions
  const sectorCounts = {};
  for (const sector of SECTORS) {
    const counts = players.map((p) => ({
      playerId: p.id,
      count: p.portfolio.filter((c) => c.sector === sector).length,
    }));
    const max = Math.max(...counts.map((c) => c.count));
    sectorCounts[sector] = { counts, max };
  }

  // Identify most-negative and most-positive sectors
  const negSectors = SECTORS.filter((s) => market[s].index === -1);
  const posSectors = SECTORS.filter((s) => market[s].index === 1);

  return players.map((player) => {
    const updatedMissions = player.missions.map((mission) => {
      let achieved = false;
      let bonusPoints = 0;

      switch (mission.id) {
        // ── Market Analyst missions ──────────────────────────────────────────
        case 'tech_analyst':
        case 'energy_analyst':
        case 'investment_banker':
        case 'pharma_investor': {
          const sector = mission.sector;
          const { counts, max } = sectorCounts[sector];
          const myCount = counts.find((c) => c.playerId === player.id)?.count ?? 0;
          achieved = max > 0 && myCount === max;
          bonusPoints = achieved ? myCount : 0;
          break;
        }

        // ── Balanced Portfolio ───────────────────────────────────────────────
        case 'balanced_portfolio': {
          achieved = SECTORS.every((s) => player.portfolio.some((c) => c.sector === s));
          bonusPoints = achieved ? 5 : 0;
          break;
        }

        // ── Big Short ────────────────────────────────────────────────────────
        case 'big_short': {
          if (negSectors.length === 0) break; // no negative sector → no bonus
          // Find which negative sector the player has most cards in
          let bestCount = 0;
          for (const s of negSectors) {
            const cnt = player.portfolio.filter((c) => c.sector === s).length;
            if (cnt > bestCount) bestCount = cnt;
          }
          // Compare against all players for those same sectors
          let globalMax = 0;
          for (const p of players) {
            for (const s of negSectors) {
              const cnt = p.portfolio.filter((c) => c.sector === s).length;
              if (cnt > globalMax) globalMax = cnt;
            }
          }
          achieved = bestCount > 0 && bestCount === globalMax;
          bonusPoints = achieved ? 4 : 0;
          break;
        }

        // ── Top Record ───────────────────────────────────────────────────────
        case 'top_record': {
          if (posSectors.length === 0) break; // no positive sector → no bonus
          let bestCount = 0;
          for (const s of posSectors) {
            const cnt = player.portfolio.filter((c) => c.sector === s).length;
            if (cnt > bestCount) bestCount = cnt;
          }
          let globalMax = 0;
          for (const p of players) {
            for (const s of posSectors) {
              const cnt = p.portfolio.filter((c) => c.sector === s).length;
              if (cnt > globalMax) globalMax = cnt;
            }
          }
          achieved = bestCount > 0 && bestCount === globalMax;
          bonusPoints = achieved ? 3 : 0;
          break;
        }

        // ── Fixer ────────────────────────────────────────────────────────────
        case 'fixer': {
          const bullCount = SECTORS.filter((s) => market[s].index === 1).length;
          const bearCount = SECTORS.filter((s) => market[s].index === -1).length;
          achieved = bullCount === 2 && bearCount === 2;
          bonusPoints = achieved ? 5 : 0;
          break;
        }

        // ── The Regulator ────────────────────────────────────────────────────
        case 'the_regulator': {
          achieved = player.portfolio.every((c) => c.type !== 'hostile_takeover');
          bonusPoints = achieved ? 4 : 0;
          break;
        }

        // ── Full Liquidity ───────────────────────────────────────────────────
        case 'full_liquidity': {
          achieved = SECTORS.every((s) => market[s].index !== 0);
          bonusPoints = achieved ? 4 : 0;
          break;
        }

        default:
          break;
      }

      return { ...mission, faceDown: false, achieved, bonusPoints };
    });

    return { ...player, missions: updatedMissions };
  });
}
