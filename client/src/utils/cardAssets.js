// client/src/utils/cardAssets.js
// Maps { sector, type } → PNG asset path.
// File naming convention: {SectorPrefix}_{TypeSuffix}.png
// e.g. Bank_Hostile.png, Tech_Shares.png, Pharma_Insider.png

const SECTOR_PREFIX = {
  tech:    'Tech',
  finance: 'Bank',
  energy:  'Energy',
  pharma:  'Pharma',
};

const TYPE_SUFFIX = {
  share_unit:      'Shares',
  regulated_asset: 'Regulate',
  insider_trading: 'Insider',
  strategic_merger:'Merger',
  hostile_takeover:'Hostile',
};

/**
 * Returns the import path for a card face image.
 * Pivot cards use a single sector-independent image: Pivot_card.png
 * All others: {SectorPrefix}_{TypeSuffix}.png
 */
export function getCardImagePath(sector, type) {
  if (type === 'pivot') return '/src/assets/cards/Pivot_card.png';
  const prefix = SECTOR_PREFIX[sector];
  const suffix = TYPE_SUFFIX[type];
  if (!prefix || !suffix) return null;
  return `/src/assets/cards/${prefix}_${suffix}.png`;
}

/**
 * Sector display names and brand colors.
 */
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

// Mission card back images — separate art per mission type
export const MISSION_BACK_PATHS = {
  market:   '/src/assets/cards/market_mission.png',
  strategy: '/src/assets/cards/Strategy_Mission.png',
};
