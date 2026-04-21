// =============================================================
// Mechanic library — persist user-authored / generated mechanics
// to localStorage and register them with the game engine.
// =============================================================

import { registerCustomMechanic } from "@/lib/customMechanics";

const STORAGE_KEY = "tcg_mechanic_library_v1";

function canStore() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readAll() {
  if (!canStore()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn("Failed to persist mechanic library", err);
  }
}

export function listMechanics() {
  return readAll();
}

export function getMechanic(id) {
  return readAll().find((m) => m.id === id) || null;
}

export function deleteMechanic(id) {
  const next = readAll().filter((m) => m.id !== id);
  writeAll(next);
  return next;
}

export function saveMechanic(mechanic) {
  const list = readAll();
  const index = list.findIndex((m) => m.id === mechanic.id);
  const record = {
    id: mechanic.id,
    name: mechanic.name || mechanic.id,
    description: mechanic.description || "",
    code: mechanic.code,
    source: mechanic.source || "custom",
    tags: mechanic.tags || [],
    installed: Boolean(mechanic.installed),
    createdAt: mechanic.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  if (index >= 0) list[index] = record;
  else list.push(record);
  writeAll(list);
  return record;
}

/**
 * Compile a mechanic's code into a callable handler.
 * Accepts either a full `registerCustomMechanic("id", fn)` block or a bare
 * arrow-body expression.
 */
export function compileMechanic(code) {
  const trimmed = (code || "").trim();
  if (!trimmed) throw new Error("Code is empty");

  // Strip a registerCustomMechanic(...) wrapper if present.
  const registerMatch = trimmed.match(
    /registerCustomMechanic\(\s*["'`]([^"'`]+)["'`]\s*,\s*([\s\S]*)\)\s*;?\s*$/m
  );
  let id = null;
  let body = trimmed;
  if (registerMatch) {
    id = registerMatch[1];
    body = registerMatch[2].trim();
    // Remove a trailing comma if any
    body = body.replace(/,\s*$/, "").trim();
  }

  // body should now be an arrow fn or function expression.
  // Wrap it in parentheses so `new Function` can evaluate it as an expression.
  // eslint-disable-next-line no-new-func
  const factory = new Function(`"use strict"; return (${body});`);
  const handler = factory();
  if (typeof handler !== "function") {
    throw new Error("Mechanic code must evaluate to a function");
  }
  return { id, handler };
}

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

export function makeMockGameState(overrides = {}) {
  const base = {
    turn: 1,
    activePlayer: "player1",
    phase: "main",
    player1: {
      id: "p1",
      activePokemon: {
        def: { name: "Pikachu", hp: 60, energy_type: "lightning" },
        damage: 0,
        energyAttached: [],
      },
      bench: [
        {
          def: { name: "Raichu", hp: 90, energy_type: "lightning" },
          damage: 0,
          energyAttached: [],
        },
      ],
      hand: [{ def: { name: "Potion" } }],
      deck: Array.from({ length: 20 }, (_, i) => ({
        def: { name: `Card ${i + 1}` },
      })),
      discard: [],
      prizes: Array.from({ length: 6 }, (_, i) => ({ def: { name: `Prize ${i + 1}` } })),
    },
    player2: {
      id: "p2",
      activePokemon: {
        def: { name: "Charmander", hp: 50, energy_type: "fire" },
        damage: 0,
        energyAttached: [],
      },
      bench: [],
      hand: [],
      deck: Array.from({ length: 20 }, (_, i) => ({
        def: { name: `Opp Card ${i + 1}` },
      })),
      discard: [],
      prizes: Array.from({ length: 6 }, (_, i) => ({ def: { name: `OP Prize ${i + 1}` } })),
    },
  };
  return { ...base, ...overrides };
}

/**
 * Validate + test a mechanic by executing it against a mocked game state.
 * Returns { ok, errors, warnings, result, durationMs }.
 */
export function validateMechanic(code, options = {}) {
  const warnings = [];
  const errors = [];
  try {
    const { handler } = compileMechanic(code);
    const mock = makeMockGameState();
    const before = cloneState(mock);
    const started = performance.now();
    const result = handler(mock, "player1", options.opts || {});
    const elapsed = performance.now() - started;

    if (!result || typeof result !== "object") {
      errors.push("Mechanic must return an object (a new game state)");
    } else {
      if (!result.player1 || !result.player2) {
        warnings.push("Result is missing player1 / player2 — engine may reject it");
      }
      if (mock !== before && JSON.stringify(mock) !== JSON.stringify(before)) {
        warnings.push("Mechanic mutated the input state; prefer returning a new object");
      }
      if (typeof result.extraLog !== "string") {
        warnings.push('Mechanic should set `extraLog` so the battle log can describe the effect');
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings,
      result,
      durationMs: Number(elapsed.toFixed(2)),
    };
  } catch (err) {
    return {
      ok: false,
      errors: [err.message || String(err)],
      warnings,
      result: null,
      durationMs: 0,
    };
  }
}

export function registerSavedMechanics() {
  const list = readAll();
  for (const mech of list) {
    if (!mech.installed) continue;
    try {
      const { handler, id } = compileMechanic(mech.code);
      registerCustomMechanic(mech.id || id || mech.name, handler);
    } catch (err) {
      console.warn(`Skipping broken mechanic "${mech.id}":`, err.message);
    }
  }
}

// ---- Local heuristic generator -----------------------------------------
// Produces a JavaScript mechanic body from the natural-language text of a
// Pokémon TCG attack. This runs entirely in the browser and requires no
// API key — used as the default generator in MechanicStudio.

const HEURISTICS = [
  {
    id: "coin-flip",
    label: "Coin flip outcome",
    match: /flip (a |the )?coin/i,
    body: `(gs, pk, opts) => {
  const heads = Math.random() < 0.5;
  return { ...gs, lastCoinFlip: heads, extraLog: heads ? "Heads — effect triggered" : "Tails — effect missed" };
}`,
  },
  {
    id: "heal-self",
    label: "Heal your active Pokémon",
    match: /heal (\d+)/i,
    body: (m) => `(gs, pk, opts) => {
  const amount = ${Number(m[1]) || 20};
  const updated = JSON.parse(JSON.stringify(gs));
  const active = updated[pk]?.activePokemon;
  if (active) {
    active.damage = Math.max(0, (active.damage || 0) - amount);
  }
  return { ...updated, extraLog: \`Healed \${amount} damage from \${active?.def?.name || "active"}\` };
}`,
  },
  {
    id: "draw-cards",
    label: "Draw cards",
    match: /draw (\d+)/i,
    body: (m) => `(gs, pk, opts) => {
  const amount = ${Number(m[1]) || 1};
  const updated = JSON.parse(JSON.stringify(gs));
  const drawn = updated[pk]?.deck?.splice(0, amount) || [];
  updated[pk].hand = [...(updated[pk].hand || []), ...drawn];
  return { ...updated, extraLog: \`Drew \${drawn.length} card(s)\` };
}`,
  },
  {
    id: "bench-damage",
    label: "Damage one of opponent's benched Pokémon",
    match: /(benched|opponent'?s bench|each of your opponent'?s)/i,
    body: `(gs, pk, opts) => {
  const updated = JSON.parse(JSON.stringify(gs));
  const opp = pk === "player1" ? "player2" : "player1";
  const damage = Number(opts?.damage) || 20;
  (updated[opp]?.bench || []).forEach((p) => {
    if (p) p.damage = (p.damage || 0) + damage;
  });
  return { ...updated, extraLog: \`Spread \${damage} damage to the bench\` };
}`,
  },
  {
    id: "energy-acceleration",
    label: "Attach an energy to your Pokémon",
    match: /attach (a |an |one |\d+ )?.*?energy/i,
    body: `(gs, pk, opts) => {
  const updated = JSON.parse(JSON.stringify(gs));
  const active = updated[pk]?.activePokemon;
  if (active) {
    active.energyAttached = active.energyAttached || [];
    active.energyAttached.push({ def: { name: "Bonus Energy", energy_type: opts?.type || "colorless" } });
  }
  return { ...updated, extraLog: "Attached bonus energy" };
}`,
  },
  {
    id: "status-condition",
    label: "Apply a status condition",
    match: /(poison|burn|sleep|paralyz|confus)/i,
    body: (m) => {
      const map = {
        poison: "poisoned",
        burn: "burned",
        sleep: "asleep",
        paralyz: "paralyzed",
        confus: "confused",
      };
      const keyword = m[1].toLowerCase();
      const condition = map[keyword] || "poisoned";
      return `(gs, pk, opts) => {
  const updated = JSON.parse(JSON.stringify(gs));
  const opp = pk === "player1" ? "player2" : "player1";
  if (updated[opp]?.activePokemon) {
    updated[opp].activePokemon.specialCondition = "${condition}";
  }
  return { ...updated, extraLog: "Inflicted ${condition}" };
}`;
    },
  },
  {
    id: "self-damage",
    label: "Take recoil damage",
    match: /(recoil|takes? \d+ damage|does? \d+ damage to itself)/i,
    body: `(gs, pk, opts) => {
  const updated = JSON.parse(JSON.stringify(gs));
  const active = updated[pk]?.activePokemon;
  const amount = Number(opts?.recoil) || 10;
  if (active) active.damage = (active.damage || 0) + amount;
  return { ...updated, extraLog: \`Took \${amount} recoil damage\` };
}`,
  },
];

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48) || "mechanic";
}

function renderMechanicRegister(id, body) {
  return `registerCustomMechanic("${id}", ${body});`;
}

/**
 * Given an attack ({ card, attack, description, damage }), return a list of
 * zero or more mechanic code blocks the heuristic inferred from its text.
 */
export function heuristicMechanicsForAttack(attack) {
  const text = `${attack.description || ""} ${attack.attack || ""}`.trim();
  if (!text) return [];
  const out = [];
  for (const rule of HEURISTICS) {
    const m = text.match(rule.match);
    if (!m) continue;
    const body = typeof rule.body === "function" ? rule.body(m) : rule.body;
    const id = `${rule.id}-${slugify(attack.attack || attack.card)}`;
    out.push({
      id,
      name: `${rule.label} — ${attack.card}`,
      description: attack.description || "",
      source: "heuristic",
      code: renderMechanicRegister(id, body),
      tags: [rule.id, "heuristic"],
    });
  }
  return out;
}

export function heuristicMechanicsForAttacks(attacks) {
  const seen = new Set();
  const out = [];
  for (const atk of attacks) {
    for (const mech of heuristicMechanicsForAttack(atk)) {
      if (seen.has(mech.id)) continue;
      seen.add(mech.id);
      out.push(mech);
    }
  }
  return out;
}
