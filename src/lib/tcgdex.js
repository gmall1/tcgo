// TCGdex API client
// Base URL: https://api.tcgdex.net/v2/en

const BASE = "https://api.tcgdex.net/v2/en";

const cache = new Map();

async function get(path) {
  if (cache.has(path)) return cache.get(path);
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`TCGdex error: ${res.status} ${path}`);
  const data = await res.json();
  cache.set(path, data);
  return data;
}

export const tcgdex = {
  // Get a single card by ID (e.g. "swsh3-136")
  getCard: (id) => get(`/cards/${id}`),

  // Search cards with filters
  // returns array of brief card objects
  getCards: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return get(`/cards${qs ? `?${qs}` : ""}`);
  },

  // Get all sets
  getSets: () => get("/sets"),

  // Get a set with all its cards
  getSet: (id) => get(`/sets/${id}`),

  // Get cards in a set
  getSetCards: (setId) => get(`/sets/${setId}/cards`),

  // Search cards by name
  searchByName: (name) => get(`/cards?name=${encodeURIComponent(name)}`),

  // Get card image URL
  cardImage: (card, quality = "high") =>
    card.image ? `${card.image}/${quality}.webp` : null,

  // Get thumbnail
  cardThumb: (card) =>
    card.image ? `${card.image}/low.webp` : null,
};

// Type color map matching TCG colors
export const TYPE_COLORS = {
  Fire:      { bg: "from-orange-500 to-red-700",    badge: "bg-red-500" },
  Water:     { bg: "from-blue-400 to-blue-700",     badge: "bg-blue-500" },
  Grass:     { bg: "from-green-400 to-emerald-700", badge: "bg-green-500" },
  Lightning: { bg: "from-yellow-300 to-amber-600",  badge: "bg-yellow-400" },
  Psychic:   { bg: "from-purple-500 to-purple-800", badge: "bg-purple-500" },
  Fighting:  { bg: "from-orange-700 to-red-900",   badge: "bg-orange-700" },
  Darkness:  { bg: "from-gray-700 to-gray-900",    badge: "bg-gray-700" },
  Metal:     { bg: "from-slate-400 to-slate-600",  badge: "bg-slate-500" },
  Fairy:     { bg: "from-pink-400 to-rose-600",    badge: "bg-pink-500" },
  Dragon:    { bg: "from-indigo-500 to-violet-800",badge: "bg-indigo-600" },
  Colorless: { bg: "from-gray-400 to-gray-600",    badge: "bg-gray-500" },
};

export function getTypeInfo(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.Colorless;
}

// Special condition icons
export const CONDITIONS = {
  poisoned:   { label: "Poisoned",  color: "bg-purple-700" },
  burned:     { label: "Burned",  color: "bg-red-700" },
  confused:   { label: "Confused",  color: "bg-pink-700" },
  paralyzed:  { label: "Paralyzed",  color: "bg-yellow-600" },
  asleep:     { label: "Asleep",  color: "bg-blue-700" },
};