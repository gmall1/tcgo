import { SAMPLE_CARDS, TYPE_COLORS } from "@/lib/cardData";
import { fetchCard, fetchCardsByIds, fetchSets, searchCards } from "@/lib/pokemonTCGApi";

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
    source: "local",
  };
}

export function normalizeApiCardToCatalog(card) {
  const cardType = card.supertype === "Pokémon" ? "pokemon" : String(card.supertype || "").toLowerCase();
  const primaryType = card.types?.[0] || null;
  const firstAttack = card.attacks?.[0] || null;
  const secondAttack = card.attacks?.[1] || null;
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
    attacks: card.attacks || [],
    abilities: card.abilities || [],
    rules: card.rules || [],
    source: "api",
  };
}

export const LOCAL_CATALOG_CARDS = SAMPLE_CARDS.map(normalizeLocalCard);
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

export function buildStarterDeck() {
  const pokemon = LOCAL_CATALOG_CARDS.filter((card) => card.card_type === "pokemon").slice(0, 12);
  const energy = LOCAL_CATALOG_CARDS.filter((card) => card.card_type === "energy");
  const filler = [];

  while (filler.length < 12 && energy.length > 0) {
    filler.push(energy[filler.length % energy.length]);
  }

  return [...pokemon, ...filler].map((card) => card.id);
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
