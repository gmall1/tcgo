// ============================================================
// AI Deck Builder — guaranteed playable decks for offline play
// ============================================================

import { getPokemonCards, getEnergyCards, buildStarterDeck, AI_DEFAULT_DECK_IDS } from "./cardCatalog";
import { getCardById } from "./cardCatalog";

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

export function buildBalancedDeck() {
  const pokemon = getPokemonCards().slice(0, 15);
  const energy = getEnergyCards().slice(0, 5);

  if (pokemon.length === 0) {
    // Absolute fallback: hardcoded minimal deck for offline play
    return HARDCODED_AI_DECK.slice();
  }

  const deck = [];

  // Add 4 copies each of first 3 basic pokemon
  for (let i = 0; i < Math.min(3, pokemon.length); i++) {
    for (let j = 0; j < 4; j++) {
      deck.push(pokemon[i].id);
    }
  }

  // Add energy to reach 60 cards
  while (deck.length < 60 && energy.length > 0) {
    const energyType = energy[deck.length % energy.length];
    deck.push(energyType.id);
  }

  return deck.slice(0, 60);
}

export function buildAggressiveDeck() {
  // Prefer high-damage attackers. Use a generous threshold so the curated
  // STARTER_POOL (Zapdos topping out at 60/100) still qualifies; if nothing
  // clears the bar we sort by best attack instead of returning an empty
  // slate that forces the fallback.
  const pool = getPokemonCards();
  let pokemon = pool
    .filter(c => (c.attack1_damage || 0) >= 50 || (c.attack2_damage || 0) >= 80)
    .slice(0, 10);
  if (pokemon.length === 0) {
    pokemon = [...pool]
      .sort((a, b) => {
        const ad = Math.max(a.attack1_damage || 0, a.attack2_damage || 0);
        const bd = Math.max(b.attack1_damage || 0, b.attack2_damage || 0);
        return bd - ad;
      })
      .slice(0, 10);
  }
  const energy = getEnergyCards().slice(0, 4);

  if (pokemon.length === 0) return HARDCODED_AI_DECK.slice();

  const deck = [];
  for (let i = 0; i < Math.min(4, pokemon.length); i++) {
    for (let j = 0; j < 4; j++) {
      deck.push(pokemon[i].id);
    }
  }

  while (deck.length < 60 && energy.length > 0) {
    const e = energy[deck.length % energy.length];
    deck.push(e.id);
  }

  return deck.slice(0, 60);
}

export function buildStallDeck() {
  const pokemon = getPokemonCards()
    .filter(c => (c.hp || 0) > 80)
    .slice(0, 8);
  const energy = getEnergyCards().slice(0, 3);

  if (pokemon.length === 0) return HARDCODED_AI_DECK.slice();

  const deck = [];
  for (let i = 0; i < Math.min(3, pokemon.length); i++) {
    for (let j = 0; j < 4; j++) {
      deck.push(pokemon[i].id);
    }
  }

  while (deck.length < 60 && energy.length > 0) {
    const e = energy[deck.length % energy.length];
    deck.push(e.id);
  }

  return deck.slice(0, 60);
}

// Offline fallback: use the curated-pool ids exported from cardCatalog so
// we never produce a deck full of ids that don't resolve. Defensive copy so
// the shared `AI_DEFAULT_DECK_IDS` constant can't be mutated by callers.
const HARDCODED_AI_DECK = AI_DEFAULT_DECK_IDS.slice();

// Transform card IDs to guaranteed-to-work card objects for engine
export function hydrateAIDeck(cardIds) {
  return cardIds
    .map(id => {
      const card = getCardById(id);
      if (card) return card;
      
      // Fallback: match by name
      const name = String(id).replace(/-/g, " ").split(" ")[0];
      return getCardById(id); // Returns null if not found
    })
    .filter(c => c !== null);
}

export function getRandomAIDeck() {
  const personalities = [buildBalancedDeck, buildAggressiveDeck, buildStallDeck];
  const picker = personalities[Math.floor(Math.random() * personalities.length)];
  return picker();
}
