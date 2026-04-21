// =============================================================
// Premade decks — seed a small set of playable, themed decks on
// first load so new users have something relevant to play without
// building a deck themselves. Runs once per browser via a marker
// stored in localStorage. Safe to re-run: does not overwrite
// decks with matching ids that the user may have customized.
// =============================================================

import {
  buildAggressiveDeck,
  buildBalancedDeck,
  buildStallDeck,
} from "@/lib/aiDeckBuilder";
import { LOCAL_CATALOG_CARDS } from "@/lib/cardCatalog";

const STORAGE_KEY = "tcg_local_db_v1";
const SEED_MARKER_KEY = "tcg_premade_decks_seed_v1";
const SEED_VERSION = 2;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readDb() {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDb(state) {
  if (!canUseStorage()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function pickCardIds(predicate, limit) {
  const out = [];
  for (const card of LOCAL_CATALOG_CARDS) {
    if (!predicate(card)) continue;
    out.push(card.id);
    if (out.length >= limit) break;
  }
  return out;
}

function countsByType(ids) {
  let pokemon = 0;
  let trainer = 0;
  let energy = 0;
  const idToCard = new Map(LOCAL_CATALOG_CARDS.map((c) => [c.id, c]));
  for (const id of ids) {
    const c = idToCard.get(id);
    if (!c) continue;
    if (c.card_type === "pokemon") pokemon++;
    else if (c.card_type === "trainer") trainer++;
    else if (c.card_type === "energy") energy++;
  }
  return { pokemon, trainer, energy };
}

function buildPremadeRecipes() {
  const aggressive = buildAggressiveDeck();
  const balanced = buildBalancedDeck();
  const stall = buildStallDeck();

  return [
    {
      id: "premade_aggro_thunder",
      name: "Thunder Rush",
      description: "Fast Lightning attackers and quick damage. Great for beginners learning tempo.",
      mode: "unlimited",
      cover_icon: "lightning",
      source: "premade",
      premade_archetype: "aggressive",
      premade: true,
      card_ids: aggressive,
    },
    {
      id: "premade_balanced_elements",
      name: "Elemental Balance",
      description: "A balanced mix of Pokémon, Trainers and Energy across types. The classic all-rounder.",
      mode: "unlimited",
      cover_icon: "colorless",
      source: "premade",
      premade_archetype: "balanced",
      premade: true,
      card_ids: balanced,
    },
    {
      id: "premade_stall_wall",
      name: "Iron Wall",
      description: "Heavy HP defenders with healing Trainers — wear the opponent down and outlast them.",
      mode: "unlimited",
      cover_icon: "metal",
      source: "premade",
      premade_archetype: "stall",
      premade: true,
      card_ids: stall,
    },
    {
      id: "premade_standard_starter",
      name: "Standard Starter",
      description: "A Standard-legal beginner deck so you can jump into Standard mode immediately.",
      mode: "standard",
      cover_icon: "fire",
      source: "premade",
      premade_archetype: "standard_starter",
      premade: true,
      card_ids: (() => {
        const basics = pickCardIds((c) => c.card_type === "pokemon", 6);
        const trainers = pickCardIds((c) => c.card_type === "trainer", 6);
        const energies = pickCardIds((c) => c.card_type === "energy", 4);
        const ids = [];
        // 4 copies of each
        for (const id of basics) for (let i = 0; i < 4; i++) ids.push(id);
        for (const id of trainers) for (let i = 0; i < 4; i++) ids.push(id);
        // fill remaining with energies
        while (ids.length < 60) {
          ids.push(energies[ids.length % Math.max(1, energies.length)]);
        }
        return ids.slice(0, 60);
      })(),
    },
  ]
    .filter((d) => Array.isArray(d.card_ids) && d.card_ids.length >= 40)
    .map((d) => {
      const counts = countsByType(d.card_ids);
      return {
        ...d,
        card_count: d.card_ids.length,
        pokemon_count: counts.pokemon,
        trainer_count: counts.trainer,
        energy_count: counts.energy,
        created_date: new Date().toISOString(),
        updated_date: new Date().toISOString(),
      };
    });
}

export function seedPremadeDecks({ force = false } = {}) {
  if (!canUseStorage()) return false;

  try {
    const marker = window.localStorage.getItem(SEED_MARKER_KEY);
    if (!force && marker && Number(marker) >= SEED_VERSION) return false;

    const db = readDb() || { Deck: [], GameRoom: [], Match: [], PlayerRank: [] };
    const decks = Array.isArray(db.Deck) ? db.Deck : [];
    const existingIds = new Set(decks.map((d) => d.id));

    const premade = buildPremadeRecipes();
    if (!premade.length) return false;

    const next = [...decks];
    for (const recipe of premade) {
      if (existingIds.has(recipe.id)) continue;
      next.push(recipe);
    }

    writeDb({ ...db, Deck: next });
    window.localStorage.setItem(SEED_MARKER_KEY, String(SEED_VERSION));
    return true;
  } catch (err) {
    console.warn("seedPremadeDecks failed", err);
    return false;
  }
}

export function isPremadeDeck(deck) {
  return Boolean(deck?.premade || deck?.source === "premade");
}
