// Tests for the offline AI deck builder.
//
// Regression guard: before this fix buildBalancedDeck produced 12 Pokémon
// and 48 Energies with zero Trainers — a 60-count but unplayable deck. The
// composeDeck helper now guarantees a Pokémon/Trainer/Energy mix using the
// real STARTER_POOL from cardData.js.

import { describe, it, expect } from "vitest";
import {
  buildAIDeck,
  buildBalancedDeck,
  buildAggressiveDeck,
  buildStallDeck,
} from "@/lib/aiDeckBuilder.js";
import { getCardById } from "@/lib/cardCatalog.js";

function summarise(ids) {
  const counts = { pokemon: 0, trainer: 0, energy: 0 };
  for (const id of ids) {
    const card = getCardById(id);
    if (!card) continue;
    counts[card.card_type] = (counts[card.card_type] || 0) + 1;
  }
  return counts;
}

describe("AI deck builder", () => {
  for (const [label, build] of [
    ["balanced", buildBalancedDeck],
    ["aggressive", buildAggressiveDeck],
    ["stall", buildStallDeck],
  ]) {
    it(`${label} builder emits a 60-card deck with Pokémon, Trainers, and Energies`, () => {
      const deck = build();
      expect(deck.length).toBe(60);

      const counts = summarise(deck);
      expect(counts.pokemon).toBeGreaterThanOrEqual(12);
      expect(counts.trainer).toBeGreaterThanOrEqual(8);
      expect(counts.energy).toBeGreaterThanOrEqual(15);
    });
  }

  it("buildAIDeck falls through to balanced when personality is unknown", () => {
    const deck = buildAIDeck("unknown-personality");
    expect(deck.length).toBe(60);
  });
});
