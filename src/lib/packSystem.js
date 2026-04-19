// ============================================================
// Pack System — Gacha pulls with rarity tiers
// ============================================================

import { getCardById, getPokemonCards, getEnergyCards } from "./cardCatalog";

export const PACK_TYPES = {
  starter: {
    name: "Starter Pack",
    cost: 500,
    currency: "tokens",
    cards: 5,
    guaranteed: { rare: 1 },
    description: "Perfect for new players",
  },
  standard: {
    name: "Standard Booster",
    cost: 1000,
    currency: "tokens",
    cards: 10,
    guaranteed: { uncommon: 1, rare: 1 },
    description: "The classic way to build your collection",
  },
  deluxe: {
    name: "Deluxe Booster",
    cost: 1500,
    currency: "tokens",
    cards: 15,
    guaranteed: { rare: 2, holo_rare: 1 },
    description: "Better odds for rare cards",
  },
  premium: {
    name: "Premium Booster",
    cost: 2500,
    currency: "tokens",
    cards: 20,
    guaranteed: { holo_rare: 1, ultra_rare: 1 },
    description: "High-end pulls for serious collectors",
  },
};

export const RARITY_DISTRIBUTION = {
  common: 0.50,
  uncommon: 0.25,
  rare: 0.15,
  holo_rare: 0.07,
  ultra_rare: 0.02,
  secret_rare: 0.01,
};

export const RARITY_ORDER = ["common", "uncommon", "rare", "holo_rare", "ultra_rare", "secret_rare"];

function getRandomCard() {
  const allCards = [...getPokemonCards(), ...getEnergyCards()];
  if (allCards.length === 0) return null;
  return allCards[Math.floor(Math.random() * allCards.length)];
}

function getCardByRarity(rarity) {
  const cards = getPokemonCards().filter(c => (c.rarity || "common") === rarity);
  if (cards.length === 0) return getRandomCard();
  return cards[Math.floor(Math.random() * cards.length)];
}

function pullCard() {
  const roll = Math.random();
  let cumulative = 0;

  for (const [rarity, weight] of Object.entries(RARITY_DISTRIBUTION)) {
    cumulative += weight;
    if (roll <= cumulative) {
      return getCardByRarity(rarity) || getRandomCard();
    }
  }

  return getRandomCard();
}

export function openPack(packType) {
  if (!PACK_TYPES[packType]) {
    throw new Error(`Invalid pack type: ${packType}`);
  }

  const config = PACK_TYPES[packType];
  const cards = [];

  // Guaranteed cards
  for (const [rarity, count] of Object.entries(config.guaranteed)) {
    for (let i = 0; i < count; i++) {
      const card = getCardByRarity(rarity);
      if (card) cards.push(card);
    }
  }

  // Fill rest with random pulls
  while (cards.length < config.cards) {
    const card = pullCard();
    if (card) cards.push(card);
  }

  return {
    packType,
    cards: cards.slice(0, config.cards),
    timestamp: Date.now(),
  };
}

export function calculateDuplicateValue(card) {
  const rarityValue = {
    common: 10,
    uncommon: 25,
    rare: 50,
    holo_rare: 100,
    ultra_rare: 250,
    secret_rare: 500,
  };
  return rarityValue[card.rarity || "common"] || 10;
}

export function savePullToCollection(pull, collectionData = {}) {
  const updated = { ...collectionData };

  for (const card of pull.cards) {
    if (!updated[card.id]) {
      updated[card.id] = { card, count: 0, pulledAt: [] };
    }
    updated[card.id].count++;
    updated[card.id].pulledAt.push(pull.timestamp);
  }

  return updated;
}

// Animation: show pull sequence
export function animatePullSequence(cards) {
  return cards.map((card, idx) => ({
    ...card,
    delay: idx * 0.15,
    rarity: card.rarity || "common",
  }));
}
