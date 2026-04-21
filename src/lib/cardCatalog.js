import { STARTER_POOL, AI_DEFAULT_DECK_IDS, TYPE_COLORS } from "@/lib/cardData";
import { fetchCard, fetchCardsByIds, fetchSets, searchCards } from "@/lib/pokemonTCGApi";
import { inferMechanicsFromAttackText } from "@/lib/customMechanics";

export { AI_DEFAULT_DECK_IDS };

const SET_CACHE_KEY = "local_tcg_live_sets_cache_v1";
const CARD_QUERY_PREFIX = "local_tcg_live_card_query_v1:";
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readCache(key) {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
      storage.removeItem(key);
      return null;
    }
    return parsed.value;
  } catch {
    return null;
  }
}

function writeCache(key, value, ttlMs = CACHE_TTL_MS) {
  const storage = getStorage();
  if (!storage) return value;

  try {
    storage.setItem(
      key,
      JSON.stringify({
        value,
        expiresAt: Date.now() + ttlMs,
      })
    );
  } catch {
    // Ignore storage quota and serialization failures.
  }

  return value;
}

function normalizeLocalCard(card, index) {
  return {
    ...card,
    id: card.id || `${slugify(card.name)}-${slugify(card.set_name || "base")}-${index}`,
    set_id: card.set_id || slugify(card.set_name || "local-demo"),
    image_small: card.image_small || null,
    image_large: card.image_large || null,
    source: card.source || "curated",
  };
}

function enrichAttacksWithMechanics(rawAttacks) {
  if (!Array.isArray(rawAttacks)) return [];
  return rawAttacks.map((atk) => {
    if (!atk) return atk;
    const mechanics = inferMechanicsFromAttackText(atk.text || "");
    if (!mechanics.length) return atk;
    const existing = Array.isArray(atk.custom_mechanics) ? atk.custom_mechanics : [];
    return {
      ...atk,
      custom_mechanics: [...existing, ...mechanics],
    };
  });
}

export function normalizeApiCardToCatalog(card) {
  const cardType = card.supertype === "Pokémon" ? "pokemon" : String(card.supertype || "").toLowerCase();
  const primaryType = card.types?.[0] || null;
  const enrichedAttacks = enrichAttacksWithMechanics(card.attacks);
  const firstAttack = enrichedAttacks[0] || null;
  const secondAttack = enrichedAttacks[1] || null;
  const description =
    card.rules?.join(" ") ||
    card.abilities?.map((ability) => `${ability.name}: ${ability.text}`).join(" ") ||
    firstAttack?.text ||
    "";

  return {
    id: card.id,
    name: card.name,
    card_type: cardType,
    energy_type: primaryType ? primaryType.toLowerCase() : cardType === "energy" ? "colorless" : null,
    set_id: card.set?.id || null,
    set_name: card.set?.name || null,
    set_series: card.set?.series || null,
    release_date: card.set?.releaseDate || null,
    rarity: card.rarity || null,
    stage: card.stage || null,
    number: card.number || null,
    hp: card.hp || null,
    attack1_name: firstAttack?.name || null,
    attack1_damage: firstAttack?.damageValue ?? 0,
    attack2_name: secondAttack?.name || null,
    attack2_damage: secondAttack?.damageValue ?? 0,
    description,
    image_small: card.imageSmall || null,
    image_large: card.imageLarge || null,
    supertype: card.supertype,
    subtypes: card.subtypes || [],
    types: card.types || [],
    attacks: enrichedAttacks,
    abilities: card.abilities || [],
    rules: card.rules || [],
    source: "api",
  };
}

export const LOCAL_CATALOG_CARDS = STARTER_POOL.map(normalizeLocalCard);
export const CATALOG_CARDS = LOCAL_CATALOG_CARDS;

const registry = new Map(LOCAL_CATALOG_CARDS.map((card) => [card.id, card]));

export function registerCatalogCards(cards = []) {
  const normalized = cards.map((card, index) => {
    const nextCard = card?.card_type ? card : normalizeApiCardToCatalog(card, index);
    registry.set(nextCard.id, nextCard);
    return nextCard;
  });
  return normalized;
}

export function getCardById(cardId) {
  return registry.get(cardId) || null;
}

export function getCardsByIds(cardIds = []) {
  return cardIds.map((cardId) => getCardById(cardId)).filter(Boolean);
}

export function getTypeStyle(type) {
  const t = (type || "colorless").toLowerCase();
  return TYPE_COLORS[t] || TYPE_COLORS.colorless;
}

export function getPokemonCards() {
  return [...registry.values()].filter((card) => card.card_type === "pokemon");
}

export function getEnergyCards() {
  return [...registry.values()].filter((card) => card.card_type === "energy");
}

export function getTrainerCards() {
  return [...registry.values()].filter((card) => card.card_type === "trainer");
}

// Build a playable 40-card starter deck with a sensible mix of Basic Pokémon,
// Trainers, and Energy. Used when a player enters a room without a chosen
// deck or when the auto-deck button is clicked.
//
// A Pokémon's catalog stage is kept as-is for display, but at deck build time
// we prefer entries whose gameplay stage is "basic" so the game can actually
// start (non-Basic cards can't be placed as the Active / Bench directly).
// EX / VMAX / VSTAR / V cards are treated as Basics for this purpose since
// they stand alone rather than evolving from another card.
const BASIC_LIKE_STAGES = new Set(["basic", "ex", "vmax", "vstar", "v", "radiant", ""]);

function isBasicLike(card) {
  if (card.card_type !== "pokemon") return false;
  const s = String(card.stage || "").toLowerCase();
  return BASIC_LIKE_STAGES.has(s);
}

export function buildStarterDeck() {
  const pool = LOCAL_CATALOG_CARDS;
  const basics = pool.filter(isBasicLike);
  const trainers = pool.filter((c) => c.card_type === "trainer");
  const energies = pool.filter((c) => c.card_type === "energy");

  if (!basics.length || !energies.length) {
    // Absolute fallback — shouldn't happen, but keep the deck non-empty.
    return pool.slice(0, 40).map((c) => c.id);
  }

  const ids = [];
  const pushCopies = (card, n) => {
    for (let i = 0; i < n; i++) ids.push(card.id);
  };

  // 16 Pokémon (up to 4 of each card, cycling through the Basic pool).
  for (let i = 0; ids.length < 16 && i < basics.length * 4; i++) {
    const card = basics[i % basics.length];
    pushCopies(card, 1);
  }

  // 8 Trainers — mix of supporters / items from whatever's loaded.
  for (let i = 0; ids.length < 24 && i < trainers.length * 4; i++) {
    const card = trainers[i % trainers.length];
    pushCopies(card, 1);
  }

  // 16 Energies — spread across types so attacks can actually be paid.
  for (let i = 0; ids.length < 40; i++) {
    const card = energies[i % energies.length];
    pushCopies(card, 1);
  }

  return ids;
}

const ENERGIES_CACHE_KEY = "local_tcg_live_energies_v1";
const TRAINERS_CACHE_KEY = "local_tcg_live_trainers_v1";

async function fetchGlobalByType({ query, cacheKey, pageSize = 120, ttl = 1000 * 60 * 60 * 6 }) {
  const cached = readCache(cacheKey);
  if (cached) {
    registerCatalogCards(cached);
    return cached;
  }

  try {
    const result = await searchCards(query, 1, pageSize);
    const normalized = (result?.cards || []).map(normalizeApiCardToCatalog);
    registerCatalogCards(normalized);
    writeCache(cacheKey, normalized, ttl);
    return normalized;
  } catch {
    return [];
  }
}

/**
 * Fetch all Basic Energy cards once and cache them. These are always shown
 * at the top of the deck builder so users don't have to hunt for energies
 * inside each expansion.
 */
export async function fetchAllEnergiesCached() {
  return fetchGlobalByType({
    query: "supertype:Energy subtypes:Basic",
    cacheKey: ENERGIES_CACHE_KEY,
    pageSize: 30,
  });
}

/**
 * Fetch a broad selection of Trainer cards so they're always available in the
 * deck builder regardless of which expansion is currently selected. Limited
 * to recent sets + popular staples via an orderBy=-releaseDate query.
 */
export async function fetchAllTrainersCached() {
  return fetchGlobalByType({
    query: "supertype:Trainer",
    cacheKey: TRAINERS_CACHE_KEY,
    pageSize: 120,
  });
}

export async function fetchExpansionSetsCached() {
  const cached = readCache(SET_CACHE_KEY);
  if (cached) return cached;

  try {
    const sets = await fetchSets();
    return writeCache(SET_CACHE_KEY, sets, CACHE_TTL_MS);
  } catch {
    const fallbackSets = [
      {
        id: "local-demo",
        name: "Local Demo Set",
        series: "Offline",
        total: LOCAL_CATALOG_CARDS.length,
        releaseDate: null,
        images: { symbol: null, logo: null },
      },
    ];
    return fallbackSets;
  }
}

function buildQuery({ search = "", filter = "all", setId = "" }) {
  const parts = [];

  if (setId && setId !== "local-demo") {
    parts.push(`set.id:${setId}`);
  }

  if (filter === "pokemon") parts.push("supertype:Pokémon");
  if (filter === "trainer") parts.push("supertype:Trainer");
  if (filter === "energy") parts.push("supertype:Energy");

  const cleanSearch = search.trim().replace(/["\\]/g, "");
  if (cleanSearch) {
    const searchTerms = cleanSearch.split(/\s+/).filter(Boolean);
    searchTerms.forEach((term) => {
      parts.push(`name:${term}*`);
    });
  }

  return parts.join(" ");
}

function filterLocalCards({ search = "", filter = "all", setId = "" }) {
  const query = search.trim().toLowerCase();

  return LOCAL_CATALOG_CARDS.filter((card) => {
    const matchesFilter = filter === "all" ? true : card.card_type === filter;
    const matchesSet = !setId || setId === "local-demo" ? true : card.set_id === setId;
    const matchesSearch = !query
      ? true
      : [card.name, card.set_name, card.energy_type, card.rarity]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

    return matchesFilter && matchesSet && matchesSearch;
  });
}

export async function fetchCatalogCards({ search = "", filter = "all", setId = "", page = 1, pageSize = 48 } = {}) {
  if (setId === "local-demo") {
    const localCards = filterLocalCards({ search, filter, setId });
    registerCatalogCards(localCards);
    return {
      cards: localCards.slice(0, pageSize),
      totalCount: localCards.length,
      source: "local",
    };
  }

  const cacheKey = `${CARD_QUERY_PREFIX}${JSON.stringify({ search, filter, setId, page, pageSize })}`;
  const cached = readCache(cacheKey);
  if (cached) {
    registerCatalogCards(cached.cards || []);
    return cached;
  }

  try {
    const query = buildQuery({ search, filter, setId });
    const result = query
      ? await searchCards(query, page, pageSize)
      : { cards: LOCAL_CATALOG_CARDS.slice(0, pageSize), totalCount: LOCAL_CATALOG_CARDS.length, page, pageSize };

    const normalizedCards = registerCatalogCards((result.cards || []).map(normalizeApiCardToCatalog));
    const payload = {
      cards: normalizedCards,
      totalCount: result.totalCount || normalizedCards.length,
      source: normalizedCards.length > 0 ? "api" : "local",
    };

    return writeCache(cacheKey, payload, 1000 * 60 * 30);
  } catch {
    const localCards = filterLocalCards({ search, filter, setId });
    registerCatalogCards(localCards);
    return {
      cards: localCards.slice(0, pageSize),
      totalCount: localCards.length,
      source: "local",
    };
  }
}

export async function hydrateCardsByIds(cardIds = []) {
  const missing = [...new Set(cardIds)].filter((cardId) => cardId && !registry.has(cardId));
  if (missing.length === 0) {
    return getCardsByIds(cardIds);
  }

  try {
    const cards = await fetchCardsByIds(missing);
    registerCatalogCards(cards.map(normalizeApiCardToCatalog));
  } catch {
    const fetchedCards = [];
    for (const cardId of missing) {
      try {
        const card = await fetchCard(cardId);
        fetchedCards.push(normalizeApiCardToCatalog(card));
      } catch {
        // Ignore unavailable card IDs and keep local fallback behavior.
      }
    }
    registerCatalogCards(fetchedCards);
  }

  return getCardsByIds(cardIds);
}

export { TYPE_COLORS };
