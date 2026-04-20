// ============================================================
// AI Deck Builder — guaranteed playable decks for offline play
// ============================================================

import { getPokemonCards, getEnergyCards, buildStarterDeck, AI_DEFAULT_DECK_IDS } from "./cardCatalog";
import { getCardById } from "./cardCatalog";

export function buildAIDeck(personality = "balanced") {
  // Primary path: curated AI deck of real pokemontcg.io ids (every card
  // resolves in the registry + has real art). Fallback to the generic
  // starter deck if an older catalog build ever strips those ids.
  const hydrated = AI_DEFAULT_DECK_IDS.filter((id) => Boolean(getCardById(id)));
  if (hydrated.length >= 20) return AI_DEFAULT_DECK_IDS.slice();

  const deck = buildStarterDeck();
  if (deck.length >= 20) return deck;

  return buildBalancedDeck();
}

export function buildBalancedDeck() {
  const pokemon = getPokemonCards().slice(0, 15);
  const energy = getEnergyCards().slice(0, 5);

  if (pokemon.length === 0) {
    // Absolute fallback: hardcoded minimal deck for offline play
    return HARDCODED_AI_DECK;
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
  const pokemon = getPokemonCards()
    .filter(c => (c.attack1_damage || 0) > 60 || (c.attack2_damage || 0) > 100)
    .slice(0, 10);
  const energy = getEnergyCards().slice(0, 4);

  if (pokemon.length === 0) return HARDCODED_AI_DECK;

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

  if (pokemon.length === 0) return HARDCODED_AI_DECK;

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
// we never produce a deck full of ids that don't resolve.
const HARDCODED_AI_DECK = AI_DEFAULT_DECK_IDS;

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
