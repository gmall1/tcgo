const BASE_URL = "https://api.pokemontcg.io/v2";
const API_KEY = import.meta.env.VITE_POKEMONTCG_API_KEY;
const MEMORY_CACHE = new Map();
const DEFAULT_TTL_MS = 1000 * 60 * 30;

function getHeaders() {
  return API_KEY ? { "X-Api-Key": API_KEY } : {};
}

function getCacheEntry(key) {
  const entry = MEMORY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    MEMORY_CACHE.delete(key);
    return null;
  }
  return entry.data;
}

function setCacheEntry(key, data, ttlMs = DEFAULT_TTL_MS) {
  MEMORY_CACHE.set(key, {
    data,
    expiresAt: Date.now() + ttlMs,
  });
  return data;
}

async function request(path, ttlMs = DEFAULT_TTL_MS) {
  const url = `${BASE_URL}${path}`;
  const cached = getCacheEntry(url);
  if (cached) return cached;

  const response = await fetch(url, { headers: getHeaders() });
  if (!response.ok) {
    throw new Error(`Pokémon TCG API error: ${response.status}`);
  }

  const json = await response.json();
  return setCacheEntry(url, json, ttlMs);
}

function parseDamage(damage) {
  if (!damage) return 0;
  const match = String(damage).match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function getStage(raw) {
  if (raw.supertype !== "Pokémon") return null;
  const subtypes = raw.subtypes || [];
  if (subtypes.includes("Basic")) return "basic";
  if (subtypes.includes("Stage 1")) return "stage1";
  if (subtypes.includes("Stage 2")) return "stage2";
  if (subtypes.includes("VMAX")) return "vmax";
  if (subtypes.includes("VSTAR")) return "vstar";
  if (subtypes.includes("ex") || subtypes.includes("EX")) return "ex";
  if (subtypes.includes("GX")) return "gx";
  if (subtypes.includes("V")) return "v";
  if (subtypes.includes("Mega")) return "mega";
  return "basic";
}

export function normalizeCard(raw) {
  return {
    id: raw.id,
    name: raw.name,
    supertype: raw.supertype,
    subtypes: raw.subtypes || [],
    hp: raw.hp ? parseInt(raw.hp, 10) : null,
    types: raw.types || [],
    evolvesFrom: raw.evolvesFrom || null,
    evolvesTo: raw.evolvesTo || [],
    attacks: (raw.attacks || []).map((attack) => ({
      name: attack.name,
      cost: attack.cost || [],
      convertedEnergyCost: attack.convertedEnergyCost || 0,
      damage: attack.damage || "0",
      damageValue: parseDamage(attack.damage),
      text: attack.text || "",
    })),
    abilities: (raw.abilities || []).map((ability) => ({
      name: ability.name,
      text: ability.text,
      type: ability.type,
    })),
    weaknesses: raw.weaknesses || [],
    resistances: raw.resistances || [],
    retreatCost: raw.retreatCost || [],
    convertedRetreatCost: raw.convertedRetreatCost || 0,
    rules: raw.rules || [],
    set: raw.set
      ? {
          id: raw.set.id,
          name: raw.set.name,
          series: raw.set.series,
          total: raw.set.total,
          printedTotal: raw.set.printedTotal,
          releaseDate: raw.set.releaseDate,
          symbol: raw.set.images?.symbol || null,
          logo: raw.set.images?.logo || null,
        }
      : null,
    number: raw.number,
    rarity: raw.rarity || "Common",
    imageSmall: raw.images?.small || null,
    imageLarge: raw.images?.large || null,
    isSupporter: (raw.subtypes || []).includes("Supporter"),
    isItem: (raw.subtypes || []).includes("Item"),
    isStadium: (raw.subtypes || []).includes("Stadium"),
    isTool: (raw.subtypes || []).includes("Pokémon Tool"),
    isBasicEnergy: raw.supertype === "Energy" && (raw.subtypes || []).includes("Basic"),
    isSpecialEnergy: raw.supertype === "Energy" && (raw.subtypes || []).includes("Special"),
    stage: getStage(raw),
  };
}

export async function fetchCardsBySet(setId, page = 1, pageSize = 60) {
  const query = encodeURIComponent(`set.id:${setId}`);
  const json = await request(`/cards?q=${query}&page=${page}&pageSize=${pageSize}&orderBy=number`);
  return (json.data || []).map(normalizeCard);
}

export async function fetchCard(cardId) {
  const json = await request(`/cards/${cardId}`);
  return normalizeCard(json.data);
}

export async function fetchCardsByIds(ids) {
  if (!ids || ids.length === 0) return [];
  const uniqueIds = [...new Set(ids)].filter(Boolean);
  const query = encodeURIComponent(uniqueIds.map((id) => `id:${id}`).join(" OR "));
  const json = await request(`/cards?q=${query}&pageSize=250`);
  return (json.data || []).map(normalizeCard);
}

export async function searchCards(query, page = 1, pageSize = 36) {
  const encoded = encodeURIComponent(query);
  const json = await request(`/cards?q=${encoded}&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate,number`);
  return {
    cards: (json.data || []).map(normalizeCard),
    totalCount: json.totalCount || 0,
    page: json.page || page,
    pageSize: json.pageSize || pageSize,
  };
}

export async function fetchSets(pageSize = 250) {
  const json = await request(`/sets?orderBy=-releaseDate&pageSize=${pageSize}`, 1000 * 60 * 60 * 12);
  return json.data || [];
}

export async function buildRandomAIDeck(setId = "sv3") {
  try {
    const cards = await fetchCardsBySet(setId, 1, 120);
    const basics = cards.filter((card) => card.supertype === "Pokémon" && card.stage === "basic");
    const trainers = cards.filter((card) => card.supertype === "Trainer");
    const energies = cards.filter((card) => card.supertype === "Energy" && card.isBasicEnergy);

    const deck = [];
    basics.slice(0, 6).forEach((card) => {
      deck.push(card, card, card, card);
    });
    trainers.slice(0, 10).forEach((card) => {
      deck.push(card, card);
    });

    const energyType = basics[0]?.types?.[0] || "Fire";
    const matchingEnergy = energies.find((card) => card.name.toLowerCase().includes(energyType.toLowerCase())) || energies[0];

    if (matchingEnergy) {
      while (deck.length < 60) {
        deck.push({ ...matchingEnergy });
      }
    }

    return deck.slice(0, 60);
  } catch {
    return [];
  }
}
