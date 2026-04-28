// ============================================================
// AI Deck Builder — guaranteed playable decks for offline play
// ============================================================

import {
  getPokemonCards,
  getEnergyCards,
  getTrainerCards,
  buildStarterDeck,
  AI_DEFAULT_DECK_IDS,
  getCardById,
} from "./cardCatalog";

export function buildAIDeck(personality = "balanced") {
  // Delegate to the per-personality builder so we always emit a 60-card
  // deck whose ids are guaranteed to hydrate via the registry. The curated
  // AI_DEFAULT_DECK_IDS is only used as an absolute-last-resort fallback
  // below when every other path fails (e.g. the catalog is empty).
  const byPersonality = {
    aggressive: buildAggressiveDeck,
    stall: buildStallDeck,
    balanced: buildBalancedDeck,
  };
  const build = byPersonality[personality] || buildBalancedDeck;
  const deck = build();
  if (deck.length >= 40) return deck;

  const starter = buildStarterDeck();
  if (starter.length >= 40) return starter;

  return HARDCODED_AI_DECK.slice();
}

// Shared helper: compose a 60-card deck with a playable Pokémon / Trainer /
// Energy mix. Callers pass the ordered pool of Pokémon they care about plus
// a target energy type so attacks can actually be paid.
function composeDeck({ pokemonPool, targetType, pokemonCount = 20, trainerCount = 12 }) {
  const pokemonSource = pokemonPool.length ? pokemonPool : getPokemonCards();
  if (!pokemonSource.length) return HARDCODED_AI_DECK.slice();

  const trainers = getTrainerCards();
  const energies = getEnergyCards();
  const basicEnergies = energies.filter((e) => e.energy_type && !/special/i.test(e.rarity || ""));
  const energyPool = basicEnergies.length ? basicEnergies : energies;

  const deck = [];

  // 20 Pokémon slots — 4 copies of up to 5 distinct Pokémon, cycling.
  for (let i = 0; deck.length < pokemonCount; i++) {
    const card = pokemonSource[i % pokemonSource.length];
    for (let j = 0; j < 4 && deck.length < pokemonCount; j++) deck.push(card.id);
  }

  // 12 Trainer slots — 4 copies of up to 3 distinct Trainers.
  if (trainers.length) {
    for (let i = 0; deck.length < pokemonCount + trainerCount; i++) {
      const card = trainers[i % trainers.length];
      for (let j = 0; j < 4 && deck.length < pokemonCount + trainerCount; j++) deck.push(card.id);
    }
  }

  // Remaining slots = energy, biased toward the deck's primary type.
  const typed = energyPool.filter((e) => e.energy_type === targetType);
  const colorless = energyPool.filter((e) => e.energy_type === "colorless");
  const ordered = [...typed, ...colorless, ...energyPool];
  if (ordered.length) {
    while (deck.length < 60) {
      deck.push(ordered[deck.length % ordered.length].id);
    }
  }

  // If trainers or energies were missing, top up from the broader pool so we
  // never return a short deck.
  while (deck.length < 60) {
    deck.push(pokemonSource[deck.length % pokemonSource.length].id);
  }

  return deck.slice(0, 60);
}

function dominantType(pokemon) {
  const counts = new Map();
  for (const c of pokemon) {
    const t = c.energy_type || "colorless";
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  let best = "colorless";
  let bestCount = -1;
  for (const [t, n] of counts) {
    if (n > bestCount) {
      best = t;
      bestCount = n;
    }
  }
  return best;
}

// Pick N items from `arr` without replacement. We shuffle a copy with the
// Fisher-Yates algorithm so the deck doesn't pull the same first-five
// Pokémon every match — crucial for the AI feeling distinct per match.
function pickRandom(arr, n) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function buildBalancedDeck() {
  const pool = getPokemonCards();
  if (!pool.length) return HARDCODED_AI_DECK.slice();
  // Pick a random type focus, then 5 distinct Pokémon weighted toward that
  // type so the deck reads as "themed" rather than a random soup.
  const types = Array.from(new Set(pool.map((c) => c.energy_type).filter(Boolean)));
  const focusType = types.length ? types[Math.floor(Math.random() * types.length)] : null;
  const focused = pool.filter((c) => c.energy_type === focusType);
  const others = pool.filter((c) => c.energy_type !== focusType);
  const pokemon = [
    ...pickRandom(focused, Math.min(3, focused.length)),
    ...pickRandom(others, 5),
  ].slice(0, 5);
  return composeDeck({
    pokemonPool: pokemon.length ? pokemon : pickRandom(pool, 5),
    targetType: dominantType(pokemon),
  });
}

export function buildAggressiveDeck() {
  const pool = getPokemonCards();
  if (!pool.length) return HARDCODED_AI_DECK.slice();
  // Hitters first, then random pick from the top 12 so we still get variety.
  const hitters = [...pool].sort((a, b) => {
    const ad = Math.max(a.attack1_damage || 0, a.attack2_damage || 0);
    const bd = Math.max(b.attack1_damage || 0, b.attack2_damage || 0);
    return bd - ad;
  }).slice(0, 12);
  const pokemon = pickRandom(hitters, 5);
  return composeDeck({
    pokemonPool: pokemon,
    targetType: dominantType(pokemon),
    pokemonCount: 16,
    trainerCount: 12,
  });
}

export function buildStallDeck() {
  const pool = getPokemonCards();
  if (!pool.length) return HARDCODED_AI_DECK.slice();
  // Tanks first (top 12 by HP), then random pick of 5 so two consecutive
  // stall matches don't bring the same wall every time.
  const tanks = [...pool].sort((a, b) => (b.hp || 0) - (a.hp || 0)).slice(0, 12);
  const pokemon = pickRandom(tanks, 5);
  return composeDeck({
    pokemonPool: pokemon,
    targetType: dominantType(pokemon),
    pokemonCount: 16,
    trainerCount: 16,
  });
}

// Offline fallback: use the curated-pool ids exported from cardCatalog so
// we never produce a deck full of ids that don't resolve. Defensive copy so
// the shared `AI_DEFAULT_DECK_IDS` constant can't be mutated by callers.
const HARDCODED_AI_DECK = AI_DEFAULT_DECK_IDS.slice();

// Transform card IDs to guaranteed-to-work card objects for engine
export function hydrateAIDeck(cardIds) {
  return cardIds
    .map((id) => getCardById(id))
    .filter((c) => c !== null);
}

export function getRandomAIDeck() {
  const personalities = [buildBalancedDeck, buildAggressiveDeck, buildStallDeck];
  const picker = personalities[Math.floor(Math.random() * personalities.length)];
  return picker();
}
