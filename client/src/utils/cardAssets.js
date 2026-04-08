// client/src/utils/cardAssets.js
// Maps { sector, type } → PNG asset path using Vite's new URL pattern.
// Actual filenames in client/src/assets/cards/ have inconsistent casing and
// some typos — this file maps (sector:type) to the exact filename on disk.

// (sector:type) → exact filename as it exists in the repo.
// NOTE: several files have typos ("Sahres" not "Shares") or spaces in the
// name — these match the actual files committed to the repository.
const FILE_MAP = {
  'tech:share_unit':       'Tech_Sahres.png',
  'tech:regulated_asset':  'Tech_Regulated.png',
  'tech:insider_trading':  'Tech_insider.png',
  'tech:strategic_merger': 'Tech_Merger.png',
  'tech:hostile_takeover': 'Tech Hostile.png',

  'finance:share_unit':       'Bank_Sahres.png',
  'finance:regulated_asset':  'bank_Regulated.png',
  'finance:insider_trading':  'bank_insider.png',
  'finance:strategic_merger': 'bank_Merger.png',
  'finance:hostile_takeover': 'Bank_Hostile.png',

  'energy:share_unit':       'energy_Sahres.png',
  'energy:regulated_asset':  'energy_Regulated.png',
  'energy:insider_trading':  'energy_insider.png',
  'energy:strategic_merger': 'energy_Merger.png',
  'energy:hostile_takeover': 'energy_Hostile.png',

  'pharma:share_unit':       'pharma_Sahres.png',
  'pharma:regulated_asset':  'pharma_Regulated.png',
  'pharma:insider_trading':  'pharma_insider.png',
  'pharma:strategic_merger': 'pharma_Merger.png',
  'pharma:hostile_takeover': 'Pahrma Hostile.png',
};

/**
 * Returns the resolved image URL for a card face using Vite's new URL().
 * This works in both dev and production builds.
 * Pivot cards use a single sector-independent image.
 */
export function getCardImagePath(sector, type) {
  if (type === 'pivot') {
    return new URL('../assets/cards/Pivot_card.png', import.meta.url).href;
  }
  const filename = FILE_MAP[`${sector}:${type}`];
  if (!filename) return null;
  return new URL(`../assets/cards/${filename}`, import.meta.url).href;
}

/** Sector display names and brand colours. */
export const SECTOR_META = {
  tech:    { label: 'Technology', color: '#3B82F6', bgClass: 'bg-tech',    textClass: 'text-tech'    },
  finance: { label: 'Finance',    color: '#22C55E', bgClass: 'bg-finance',  textClass: 'text-finance'  },
  energy:  { label: 'Energy',     color: '#F97316', bgClass: 'bg-energy',   textClass: 'text-energy'   },
  pharma:  { label: 'Pharma',     color: '#EC4899', bgClass: 'bg-pharma',   textClass: 'text-pharma'   },
};

export const CARD_TYPE_META = {
  share_unit:       { label: 'Share Unit',        icon: '📈', value: 1 },
  regulated_asset:  { label: 'Regulated Asset',   icon: '🛡️', value: 1 },
  insider_trading:  { label: 'Insider Trading',   icon: '🔒', value: 1 },
  strategic_merger: { label: 'Strategic Merger',  icon: '🤝', value: 2 },
  hostile_takeover: { label: 'Hostile Takeover',  icon: '⚔️', value: 1 },
  pivot:            { label: 'Pivot',             icon: '🔄', value: 1 },
  hidden:           { label: 'Hidden Card',       icon: '❓', value: '?' },
};

/** Mission card back images. */
export const MISSION_BACK_PATHS = {
  market:   new URL('../assets/cards/market_mission.png', import.meta.url).href,
  strategy: new URL('../assets/cards/Strategy_Mission.png', import.meta.url).href,
};
