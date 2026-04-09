// client/src/utils/cardAssets.js
// Uses import.meta.glob so Vite correctly processes card images in production
// builds (hashed filenames, correct public URLs).
//
// Actual filenames in client/src/assets/cards/ have inconsistent casing and
// a few typos — this file maps (sector:type) to the exact filename on disk.
 
// Eagerly import every PNG from the cards directory so Vite includes them in
// the build and returns their resolved public URLs.
import pivotCardUrl from '../assets/cards/Pivot_card.png';
const _modules = import.meta.glob('../assets/cards/*.png', { eager: true });
 
// filename (e.g. "Bank_Hostile.png") → resolved URL string
const CARD_URLS = {};
for (const [path, mod] of Object.entries(_modules)) {
  const filename = path.split('/').pop();
  CARD_URLS[filename] = mod.default;
}
 
// (sector:type) → exact filename as it exists in the repo.
// NOTE: filenames have mixed casing and some capitalization inconsistencies.
const FILE_MAP = {
  'tech:share_unit':       'tech_shares.png',
  'tech:regulated_asset':  'Tech_Regulated.png',
  'tech:insider_trading':  'Tech_insider.png',
  'tech:strategic_merger': 'Tech_Merger.png',
  'tech:hostile_takeover': 'tech_hostile.png',

  'finance:share_unit':       'bank_shares.png',
  'finance:regulated_asset':  'bank_Regulated.png',
  'finance:insider_trading':  'bank_insider.png',
  'finance:strategic_merger': 'bank_Merger.png',
  'finance:hostile_takeover': 'Bank_Hostile.png',

  'energy:share_unit':       'energy_shares.png',
  'energy:regulated_asset':  'energy_Regulated.png',
  'energy:insider_trading':  'energy_insider.png',
  'energy:strategic_merger': 'energy_Merger.png',
  'energy:hostile_takeover': 'energy_Hostile.png',

  'pharma:share_unit':       'pharma_shares.png',
  'pharma:regulated_asset':  'pharma_Regulated.png',
  'pharma:insider_trading':  'pharma_insider.png',
  'pharma:strategic_merger': 'pharma_Merger.png',
  'pharma:hostile_takeover': 'pharma_hostile.png',
};

/**
 * * Returns the resolved image URL for a card face, or null if not found.
 * Pivot cards use a single sector-independent image.
 */
export function getCardImagePath(sector, type) {
  if (type === 'pivot') return pivotCardUrl;
  const filename = FILE_MAP[`${sector}:${type}`];
  if (!filename) return null;
  return CARD_URLS[filename] ?? null;
}

/** Sector display names and brand colours. */
export const SECTOR_META = {
  tech:    { label: 'Technology', color: '#3B82F6', bgClass: 'bg-tech',    textClass: 'text-tech'    },
  finance: { label: 'Finance',    color: '#dbf113', bgClass: 'bg-finance',  textClass: 'text-finance'  },
  energy:  { label: 'Energy',     color: '#12a031', bgClass: 'bg-energy',   textClass: 'text-energy'   },
  pharma:  { label: 'Pharma',     color: '#a71a60', bgClass: 'bg-pharma',   textClass: 'text-pharma'   },
};

export const CARDS_BACK_URL = CARD_URLS['cards_backside.png'] ?? null;

export const CARD_TYPE_META = {
  share_unit:       { label: 'Share Unit',        icon: '📈', value: 1 },
  regulated_asset:  { label: 'Regulated Asset',   icon: '🛡️', value: 1 },
  insider_trading:  { label: 'Insider Trading',   icon: '🔒', value: 1 },
  strategic_merger: { label: 'Strategic Merger',  icon: '🤝', value: 2 },
  hostile_takeover: { label: 'Hostile Takeover',  icon: '⚔️', value: 1 },
  pivot:            { label: 'Pivot',             icon: '🔄', value: 1 },
  hidden:           { label: 'Hidden Card',       icon: '❓', value: '?' },
};

/** Mission card back images resolved via Vite. */
export const MISSION_BACK_PATHS = {
  market:   CARD_URLS['market_mission.png']     ?? null,
  strategy: CARD_URLS['strategy_mission_back.png'] ?? null,
};
