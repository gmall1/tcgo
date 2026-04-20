// Curated starter pool of REAL pokemontcg.io cards.
// Every id resolves against the public Pokémon TCG API (pokemontcg.io) and
// has a real card image, so nothing in the app ever renders a blank
// placeholder. Full card data is hydrated from the API on app boot; the
// fallback stats below keep the engine playable when the API is offline.
//
// SAMPLE_CARDS / the "Sample Cards" admin editor were removed — having two
// sources of truth (junk local stubs vs. real API data) was the root cause
// of the auto-deck + Psychic Energy bugs.

const TYPE_COLORS = {
  fire:       { bg: "from-red-700 to-orange-900",    text: "text-red-400",     abbr: "F"  },
  water:      { bg: "from-blue-600 to-blue-900",     text: "text-blue-400",    abbr: "W"  },
  grass:      { bg: "from-green-600 to-emerald-900", text: "text-green-400",   abbr: "G"  },
  electric:   { bg: "from-yellow-500 to-amber-800",  text: "text-yellow-400",  abbr: "L"  },
  lightning:  { bg: "from-yellow-500 to-amber-800",  text: "text-yellow-400",  abbr: "L"  },
  psychic:    { bg: "from-purple-600 to-purple-900", text: "text-purple-400",  abbr: "P"  },
  fighting:   { bg: "from-red-800 to-red-950",       text: "text-orange-300",  abbr: "FG" },
  dark:       { bg: "from-gray-700 to-gray-950",     text: "text-gray-400",    abbr: "D"  },
  darkness:   { bg: "from-gray-700 to-gray-950",     text: "text-gray-400",    abbr: "D"  },
  steel:      { bg: "from-slate-500 to-slate-800",   text: "text-slate-300",   abbr: "M"  },
  metal:      { bg: "from-slate-500 to-slate-800",   text: "text-slate-300",   abbr: "M"  },
  fairy:      { bg: "from-pink-500 to-rose-800",     text: "text-pink-400",    abbr: "Y"  },
  dragon:     { bg: "from-indigo-600 to-violet-950", text: "text-indigo-400",  abbr: "N"  },
  normal:     { bg: "from-slate-500 to-slate-700",   text: "text-gray-300",    abbr: "C"  },
  colorless:  { bg: "from-slate-500 to-slate-700",   text: "text-gray-300",    abbr: "C"  },
};

// Helper: build the pokemontcg.io CDN URL from a card id. The API id is
// always `<setId>-<number>`, and the image lives at
// images.pokemontcg.io/<setId>/<number>.png (and _hires.png).
function imgFor(id, { hires = false } = {}) {
  const dash = id.lastIndexOf("-");
  if (dash < 0) return null;
  const setId = id.slice(0, dash);
  const number = id.slice(dash + 1);
  return `https://images.pokemontcg.io/${setId}/${number}${hires ? "_hires" : ""}.png`;
}

function mkPokemon({ id, name, energy_type, hp, stage = "basic", a1, a2, weakness, retreat, set_name, rarity = "common" }) {
  return {
    id,
    name,
    card_type: "pokemon",
    energy_type,
    hp,
    stage,
    rarity,
    set_name,
    attack1_name: a1?.name || null,
    attack1_damage: a1?.dmg ?? 0,
    attack1_cost: a1?.cost ?? 1,
    attack2_name: a2?.name || null,
    attack2_damage: a2?.dmg ?? 0,
    attack2_cost: a2?.cost ?? 0,
    weakness: weakness || "none",
    retreat_cost: retreat ?? 1,
    image_small: imgFor(id),
    image_large: imgFor(id, { hires: true }),
  };
}

function mkTrainer({ id, name, description, set_name, isSupporter = false }) {
  return {
    id,
    name,
    card_type: "trainer",
    rarity: "uncommon",
    set_name,
    description,
    isSupporter,
    image_small: imgFor(id),
    image_large: imgFor(id, { hires: true }),
  };
}

function mkEnergy({ id, name, energy_type, set_name = "Scarlet & Violet Energies" }) {
  return {
    id,
    name,
    card_type: "energy",
    energy_type,
    rarity: "common",
    set_name,
    image_small: imgFor(id),
    image_large: imgFor(id, { hires: true }),
  };
}

// ---- Curated pool (~32 real cards). Every id verified against the API. ----
const STARTER_POOL = [
  // Basic Pokémon — Base Set (base1)
  mkPokemon({ id: "base1-46", name: "Charmander", energy_type: "fire", hp: 50, a1: { name: "Scratch", dmg: 10, cost: 1 }, a2: { name: "Ember", dmg: 30, cost: 2 }, weakness: "water", retreat: 1, set_name: "Base Set" }),
  mkPokemon({ id: "base1-44", name: "Bulbasaur", energy_type: "grass", hp: 40, a1: { name: "Leech Seed", dmg: 20, cost: 2 }, weakness: "fire", retreat: 1, set_name: "Base Set" }),
  mkPokemon({ id: "base1-58", name: "Pikachu", energy_type: "lightning", hp: 40, a1: { name: "Gnaw", dmg: 10, cost: 1 }, a2: { name: "Thunder Jolt", dmg: 30, cost: 2 }, weakness: "fighting", retreat: 1, set_name: "Base Set" }),
  mkPokemon({ id: "base1-20", name: "Electabuzz", energy_type: "lightning", hp: 70, a1: { name: "Thundershock", dmg: 10, cost: 1 }, a2: { name: "Thunderpunch", dmg: 30, cost: 2 }, weakness: "fighting", retreat: 2, set_name: "Base Set", rarity: "uncommon" }),
  mkPokemon({ id: "base1-28", name: "Growlithe", energy_type: "fire", hp: 60, a1: { name: "Flare", dmg: 20, cost: 2 }, weakness: "water", retreat: 1, set_name: "Base Set", rarity: "uncommon" }),
  mkPokemon({ id: "base1-36", name: "Magmar", energy_type: "fire", hp: 50, a1: { name: "Fire Punch", dmg: 30, cost: 2 }, a2: { name: "Flamethrower", dmg: 50, cost: 3 }, weakness: "water", retreat: 2, set_name: "Base Set", rarity: "uncommon" }),
  mkPokemon({ id: "base1-41", name: "Seel", energy_type: "water", hp: 60, a1: { name: "Headbutt", dmg: 10, cost: 1 }, weakness: "lightning", retreat: 1, set_name: "Base Set", rarity: "uncommon" }),
  mkPokemon({ id: "base1-59", name: "Poliwag", energy_type: "water", hp: 40, a1: { name: "Water Gun", dmg: 10, cost: 1 }, weakness: "grass", retreat: 1, set_name: "Base Set" }),
  mkPokemon({ id: "base1-35", name: "Magikarp", energy_type: "water", hp: 30, a1: { name: "Tackle", dmg: 10, cost: 1 }, a2: { name: "Flail", dmg: 10, cost: 1 }, weakness: "lightning", retreat: 1, set_name: "Base Set" }),
  mkPokemon({ id: "base1-10", name: "Mewtwo", energy_type: "psychic", hp: 60, a1: { name: "Psychic", dmg: 10, cost: 2 }, a2: { name: "Barrier", dmg: 0, cost: 2 }, weakness: "psychic", retreat: 3, set_name: "Base Set", rarity: "holo_rare" }),
  mkPokemon({ id: "base1-43", name: "Abra", energy_type: "psychic", hp: 30, a1: { name: "Psyshock", dmg: 10, cost: 1 }, weakness: "psychic", retreat: 0, set_name: "Base Set" }),
  mkPokemon({ id: "base1-49", name: "Drowzee", energy_type: "psychic", hp: 50, a1: { name: "Pound", dmg: 10, cost: 1 }, a2: { name: "Confuse Ray", dmg: 10, cost: 2 }, weakness: "psychic", retreat: 1, set_name: "Base Set" }),
  mkPokemon({ id: "base1-7", name: "Hitmonchan", energy_type: "fighting", hp: 70, a1: { name: "Jab", dmg: 20, cost: 1 }, a2: { name: "Special Punch", dmg: 40, cost: 3 }, weakness: "psychic", retreat: 2, set_name: "Base Set", rarity: "holo_rare" }),
  mkPokemon({ id: "base1-56", name: "Onix", energy_type: "fighting", hp: 90, a1: { name: "Rock Throw", dmg: 10, cost: 1 }, a2: { name: "Harden", dmg: 0, cost: 2 }, weakness: "grass", retreat: 3, set_name: "Base Set" }),
  mkPokemon({ id: "base1-16", name: "Zapdos", energy_type: "lightning", hp: 90, a1: { name: "Thunder", dmg: 60, cost: 3 }, a2: { name: "Thunderbolt", dmg: 100, cost: 4 }, weakness: "none", retreat: 3, set_name: "Base Set", rarity: "holo_rare" }),
  mkPokemon({ id: "base1-3", name: "Chansey", energy_type: "colorless", hp: 120, a1: { name: "Scrunch", dmg: 0, cost: 1 }, a2: { name: "Double-edge", dmg: 80, cost: 4 }, weakness: "fighting", retreat: 1, set_name: "Base Set", rarity: "holo_rare" }),

  // Trainers — Base Set (base1)
  mkTrainer({ id: "base1-82", name: "Full Heal", description: "Your Active Pokémon is no longer Asleep, Confused, Paralyzed, Poisoned, or Burned.", set_name: "Base Set" }),
  mkTrainer({ id: "base1-84", name: "PlusPower", description: "Attach to your Active Pokémon. If it attacks this turn, the attack does 10 more damage to the Active Pokémon.", set_name: "Base Set" }),
  mkTrainer({ id: "base1-80", name: "Defender", description: "Attach to 1 of your Pokémon. It takes 20 less damage from opponent's attacks until end of opponent's next turn.", set_name: "Base Set" }),
  mkTrainer({ id: "base1-81", name: "Energy Retrieval", description: "Trade 1 card from your hand for up to 2 basic Energy cards from your discard pile.", set_name: "Base Set" }),
  mkTrainer({ id: "base1-83", name: "Maintenance", description: "Shuffle 2 cards from your hand into your deck, then draw a card.", set_name: "Base Set" }),
  mkTrainer({ id: "base1-78", name: "Scoop Up", description: "Choose 1 of your Pokémon in play; return its Basic to your hand. Discard attached cards.", set_name: "Base Set" }),
  mkTrainer({ id: "base1-75", name: "Lass", description: "Each player shuffles all Trainer cards from their hand into their deck.", set_name: "Base Set", isSupporter: true }),
  mkTrainer({ id: "base1-73", name: "Impostor Professor Oak", description: "Your opponent shuffles their hand into their deck and draws 7 cards.", set_name: "Base Set", isSupporter: true }),

  // Basic Energies — Scarlet & Violet Energies (sve) — modern clean art
  mkEnergy({ id: "sve-1", name: "Grass Energy", energy_type: "grass" }),
  mkEnergy({ id: "sve-2", name: "Fire Energy", energy_type: "fire" }),
  mkEnergy({ id: "sve-3", name: "Water Energy", energy_type: "water" }),
  mkEnergy({ id: "sve-4", name: "Lightning Energy", energy_type: "lightning" }),
  mkEnergy({ id: "sve-5", name: "Psychic Energy", energy_type: "psychic" }),
  mkEnergy({ id: "sve-6", name: "Fighting Energy", energy_type: "fighting" }),
  mkEnergy({ id: "sve-7", name: "Darkness Energy", energy_type: "darkness" }),
  mkEnergy({ id: "sve-8", name: "Metal Energy", energy_type: "metal" }),
];

// A thin list of ids for the AI opponent's default deck. Crosses energy
// types so attacks across the pool can be paid for.
const AI_DEFAULT_DECK_IDS = [
  // 4x each of 4 attackers = 16
  "base1-46", "base1-46", "base1-46", "base1-46",
  "base1-58", "base1-58", "base1-58", "base1-58",
  "base1-7",  "base1-7",  "base1-7",  "base1-7",
  "base1-10", "base1-10", "base1-10", "base1-10",
  // 8 support basics
  "base1-3", "base1-3", "base1-28", "base1-28",
  "base1-59", "base1-59", "base1-44", "base1-44",
  // 16 energies (4 of each matching colour)
  "sve-2", "sve-2", "sve-2", "sve-2",
  "sve-4", "sve-4", "sve-4", "sve-4",
  "sve-6", "sve-6", "sve-6", "sve-6",
  "sve-5", "sve-5", "sve-5", "sve-5",
];

export { TYPE_COLORS, STARTER_POOL, AI_DEFAULT_DECK_IDS };
