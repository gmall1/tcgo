// =============================================================
// MECHANIC PRIMITIVES — palette of effects the visual Mechanic
// Builder can chain together to give any card a custom attack /
// ability without writing JavaScript by hand.
//
// Every primitive carries:
//   • id            — stable string used in card-mechanic configs
//   • label         — human-readable name shown in the UI
//   • category      — used for grouping in the palette
//   • params        — schema describing the inputs (see PARAM_TYPES)
//   • run(state,pk,p,ctx) — pure function applying the effect
//
// Guards (`if_energy_attached`, `if_per_turn`, …) live alongside
// primitives but use a separate `evaluate(...)` boolean signature.
// The runtime ANDs all guards before running the primitive.
//
// All run() functions take a *cloned* state and return a new state
// plus an optional log line in `state._mechanicLog` (a string array
// the engine harvests after every attack).
// =============================================================

const STATUS_VALUES = ["poisoned", "burned", "asleep", "paralyzed", "confused"];
const ENERGY_TYPES = [
  "Fire", "Water", "Grass", "Lightning", "Psychic", "Fighting",
  "Darkness", "Metal", "Dragon", "Fairy", "Colorless",
];

function opp(pk) { return pk === "player1" ? "player2" : "player1"; }
function pushLog(state, line) {
  if (!line) return state;
  state._mechanicLog = state._mechanicLog || [];
  state._mechanicLog.push(line);
  return state;
}
function activeEnergyTypes(mon) {
  return (mon?.energyAttached || []).map((e) => {
    const n = String(e.def?.name || "").toLowerCase();
    if (n.includes("fire")) return "Fire";
    if (n.includes("water")) return "Water";
    if (n.includes("grass")) return "Grass";
    if (n.includes("lightning") || n.includes("electric")) return "Lightning";
    if (n.includes("psychic")) return "Psychic";
    if (n.includes("fighting")) return "Fighting";
    if (n.includes("dark")) return "Darkness";
    if (n.includes("metal") || n.includes("steel")) return "Metal";
    if (n.includes("dragon")) return "Dragon";
    if (n.includes("fairy")) return "Fairy";
    return "Colorless";
  });
}

// ── Param schema -----------------------------------------------------------
export const PARAM_TYPES = {
  number: "number",
  text: "text",
  status: "status",
  energyType: "energyType",
  benchTarget: "benchTarget",
  selfTarget: "selfTarget",
  bool: "bool",
};

// ── Primitives -------------------------------------------------------------
// Keep these alphabetised by id within each category for stable diffs.
export const PRIMITIVES = [
  // ── Damage ─
  {
    id: "deal_damage",
    label: "Deal extra damage",
    category: "Damage",
    description: "Adds N to the attack's printed damage value.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 10, min: 0 }],
    run: (s, pk, p, ctx) => {
      ctx.bonusDamage = (ctx.bonusDamage || 0) + Number(p.amount || 0);
      return pushLog(s, `+${p.amount} bonus damage.`);
    },
  },
  {
    id: "damage_active_extra",
    label: "Deal damage to opponent's Active",
    category: "Damage",
    description: "Direct damage to opponent's Active Pokémon, after weakness.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 20, min: 0 }],
    run: (s, pk, p) => {
      const op = s[opp(pk)];
      if (!op?.activePokemon) return s;
      op.activePokemon.damage = (op.activePokemon.damage || 0) + Number(p.amount || 0);
      return pushLog(s, `Hit Active for ${p.amount}.`);
    },
  },
  {
    id: "damage_bench_each",
    label: "Damage each opponent benched",
    category: "Damage",
    description: "Spread N damage to every benched opponent.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 10, min: 0 }],
    run: (s, pk, p) => {
      const op = s[opp(pk)];
      if (!op) return s;
      op.bench = (op.bench || []).map((c) => ({ ...c, damage: (c.damage || 0) + Number(p.amount || 0) }));
      return pushLog(s, `Spread ${p.amount} to each opponent benched.`);
    },
  },
  {
    id: "damage_bench_one",
    label: "Snipe one benched Pokémon",
    category: "Damage",
    description: "Pick a benched opponent (by strategy) and deal N damage.",
    params: [
      { key: "amount", type: PARAM_TYPES.number, default: 30, min: 0 },
      {
        key: "target",
        type: PARAM_TYPES.benchTarget,
        default: "highest_threat",
        options: ["highest_threat", "lowest_hp", "random"],
      },
    ],
    run: (s, pk, p) => {
      const op = s[opp(pk)];
      const bench = op?.bench || [];
      if (!bench.length) return pushLog(s, "No benched opponent to snipe.");
      let idx = 0;
      if (p.target === "lowest_hp") {
        idx = bench.map((c, i) => ({ i, hp: (c.def?.hp || 0) - (c.damage || 0) })).sort((a, b) => a.hp - b.hp)[0].i;
      } else if (p.target === "random") {
        idx = Math.floor(Math.random() * bench.length);
      } else {
        idx = bench.map((c, i) => ({ i, score: (c.energyAttached?.length || 0) * 10 + ((c.def?.hp || 0) - (c.damage || 0)) }))
          .sort((a, b) => b.score - a.score)[0].i;
      }
      bench[idx] = { ...bench[idx], damage: (bench[idx].damage || 0) + Number(p.amount || 0) };
      op.bench = bench;
      return pushLog(s, `Sniped ${bench[idx].def?.name || "benched"} for ${p.amount}.`);
    },
  },
  {
    id: "recoil",
    label: "Take recoil damage",
    category: "Damage",
    description: "The attacker takes N damage to itself.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 10, min: 0 }],
    run: (s, pk, p) => {
      const me = s[pk];
      if (!me?.activePokemon) return s;
      me.activePokemon.damage = (me.activePokemon.damage || 0) + Number(p.amount || 0);
      return pushLog(s, `${me.activePokemon.def?.name || "Attacker"} took ${p.amount} recoil.`);
    },
  },

  // ── Healing ─
  {
    id: "heal_self",
    label: "Heal the attacker",
    category: "Healing",
    description: "Heal N damage from the attacking Pokémon.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 20, min: 0 }],
    run: (s, pk, p) => {
      const me = s[pk];
      if (!me?.activePokemon) return s;
      me.activePokemon.damage = Math.max(0, (me.activePokemon.damage || 0) - Number(p.amount || 0));
      return pushLog(s, `Healed ${p.amount} from ${me.activePokemon.def?.name || "Active"}.`);
    },
  },
  {
    id: "heal_bench_each",
    label: "Heal every Pokémon you have",
    category: "Healing",
    description: "Heal N damage from each of your Pokémon (Active + Bench).",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 10, min: 0 }],
    run: (s, pk, p) => {
      const me = s[pk];
      if (!me) return s;
      if (me.activePokemon) me.activePokemon.damage = Math.max(0, (me.activePokemon.damage || 0) - Number(p.amount || 0));
      me.bench = (me.bench || []).map((c) => ({ ...c, damage: Math.max(0, (c.damage || 0) - Number(p.amount || 0)) }));
      return pushLog(s, `Healed ${p.amount} from each of your Pokémon.`);
    },
  },
  {
    id: "heal_all_status",
    label: "Cure all status conditions",
    category: "Healing",
    description: "Remove every special condition from the attacker.",
    params: [],
    run: (s, pk) => {
      if (s[pk]?.activePokemon) s[pk].activePokemon.specialCondition = null;
      return pushLog(s, "Cured all conditions.");
    },
  },

  // ── Status ─
  {
    id: "apply_status",
    label: "Apply special condition",
    category: "Status",
    description: "Apply a status to opponent's Active Pokémon.",
    params: [
      { key: "condition", type: PARAM_TYPES.status, default: "poisoned", options: STATUS_VALUES },
    ],
    run: (s, pk, p) => {
      if (!s[opp(pk)]?.activePokemon) return s;
      s[opp(pk)].activePokemon.specialCondition = p.condition || "poisoned";
      return pushLog(s, `Inflicted ${p.condition}.`);
    },
  },

  // ── Energy ─
  {
    id: "attach_energy_from_discard",
    label: "Attach energy from discard",
    category: "Energy",
    description: "Move 1 energy of the chosen type from your discard onto the attacker.",
    params: [
      { key: "type", type: PARAM_TYPES.energyType, default: "Colorless", options: ENERGY_TYPES },
    ],
    run: (s, pk, p) => {
      const me = s[pk];
      if (!me) return s;
      const wantLower = String(p.type || "Colorless").toLowerCase();
      const idx = (me.discard || []).findIndex((c) => {
        if (c.def?.supertype !== "Energy") return false;
        if (wantLower === "colorless") return true;
        return String(c.def?.name || "").toLowerCase().includes(wantLower);
      });
      if (idx < 0) return pushLog(s, `No ${p.type} energy in discard.`);
      const [card] = me.discard.splice(idx, 1);
      const target = me.activePokemon;
      if (!target) return s;
      target.energyAttached = [...(target.energyAttached || []), card];
      return pushLog(s, `Reattached ${card.def?.name || p.type} energy from discard.`);
    },
  },
  {
    id: "discard_opponent_energy",
    label: "Discard opponent's energy",
    category: "Energy",
    description: "Discard N energy from opponent's Active.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 1, min: 1 }],
    run: (s, pk, p) => {
      const op = s[opp(pk)];
      const ap = op?.activePokemon;
      if (!ap?.energyAttached?.length) return pushLog(s, "Opponent has no energy to discard.");
      const n = Math.min(ap.energyAttached.length, Number(p.amount || 1));
      const removed = ap.energyAttached.splice(ap.energyAttached.length - n, n);
      op.discard = [...(op.discard || []), ...removed];
      return pushLog(s, `Discarded ${n} energy from opponent.`);
    },
  },
  {
    id: "discard_self_energy",
    label: "Discard your own energy",
    category: "Energy",
    description: "Discard N energy from the attacker.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 1, min: 1 }],
    run: (s, pk, p) => {
      const me = s[pk];
      const ap = me?.activePokemon;
      if (!ap?.energyAttached?.length) return s;
      const n = Math.min(ap.energyAttached.length, Number(p.amount || 1));
      const removed = ap.energyAttached.splice(ap.energyAttached.length - n, n);
      me.discard = [...(me.discard || []), ...removed];
      return pushLog(s, `Discarded ${n} energy from ${ap.def?.name || "attacker"}.`);
    },
  },

  // ── Tempo / disruption ─
  {
    id: "draw_cards",
    label: "Draw cards",
    category: "Tempo",
    description: "Draw N cards from your deck.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 1, min: 1 }],
    run: (s, pk, p) => {
      const me = s[pk];
      if (!me?.deck?.length) return s;
      const n = Math.min(me.deck.length, Number(p.amount || 1));
      const drawn = me.deck.splice(0, n);
      me.hand = [...(me.hand || []), ...drawn];
      return pushLog(s, `Drew ${n} card(s).`);
    },
  },
  {
    id: "mill_opponent",
    label: "Mill opponent's deck",
    category: "Tempo",
    description: "Discard the top N cards of opponent's deck.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 1, min: 1 }],
    run: (s, pk, p) => {
      const op = s[opp(pk)];
      if (!op?.deck?.length) return s;
      const n = Math.min(op.deck.length, Number(p.amount || 1));
      const discarded = op.deck.splice(0, n);
      op.discard = [...(op.discard || []), ...discarded];
      return pushLog(s, `Milled ${n} card(s).`);
    },
  },
  {
    id: "search_deck_for_basic",
    label: "Search deck for a Basic Pokémon",
    category: "Tempo",
    description: "Find a Basic Pokémon in your deck and bench it.",
    params: [],
    run: (s, pk) => {
      const me = s[pk];
      if (!me) return s;
      const idx = (me.deck || []).findIndex((c) => c.def?.supertype === "Pokémon" && String(c.def?.stage || "").toLowerCase() === "basic");
      if (idx < 0) return pushLog(s, "No Basic Pokémon in deck.");
      if ((me.bench?.length || 0) >= 5) return pushLog(s, "Bench is full.");
      const [card] = me.deck.splice(idx, 1);
      me.bench = [...(me.bench || []), card];
      return pushLog(s, `Searched ${card.def?.name || "Basic"} onto Bench.`);
    },
  },
  {
    id: "search_deck_for_energy",
    label: "Search deck for energy",
    category: "Tempo",
    description: "Find 1 energy of a chosen type in your deck and attach to attacker.",
    params: [
      { key: "type", type: PARAM_TYPES.energyType, default: "Colorless", options: ENERGY_TYPES },
    ],
    run: (s, pk, p) => {
      const me = s[pk];
      const wantLower = String(p.type || "Colorless").toLowerCase();
      const idx = (me?.deck || []).findIndex((c) => {
        if (c.def?.supertype !== "Energy") return false;
        if (wantLower === "colorless") return true;
        return String(c.def?.name || "").toLowerCase().includes(wantLower);
      });
      if (idx < 0) return pushLog(s, `No ${p.type} energy in deck.`);
      const [card] = me.deck.splice(idx, 1);
      const target = me.activePokemon;
      if (target) {
        target.energyAttached = [...(target.energyAttached || []), card];
        return pushLog(s, `Attached ${card.def?.name || p.type} from deck.`);
      }
      me.hand = [...(me.hand || []), card];
      return pushLog(s, `Searched ${card.def?.name || p.type} into hand.`);
    },
  },

  // ── Position ─
  {
    id: "switch_self",
    label: "Switch yourself out",
    category: "Position",
    description: "Swap the attacker with one of your Bench (highest HP).",
    params: [],
    run: (s, pk) => {
      const me = s[pk];
      if (!me?.bench?.length || !me.activePokemon) return s;
      const idx = me.bench.map((c, i) => ({ i, hp: (c.def?.hp || 0) - (c.damage || 0) })).sort((a, b) => b.hp - a.hp)[0].i;
      const incoming = me.bench[idx];
      me.bench = [...me.bench.filter((_, i) => i !== idx), { ...me.activePokemon, specialCondition: null }];
      me.activePokemon = { ...incoming, specialCondition: null };
      return pushLog(s, `Switched in ${incoming.def?.name || "bench Pokémon"}.`);
    },
  },
  {
    id: "switch_opponent",
    label: "Force opponent to switch",
    category: "Position",
    description: "Promote one of opponent's bench (lowest HP) to Active.",
    params: [],
    run: (s, pk) => {
      const op = s[opp(pk)];
      if (!op?.bench?.length || !op.activePokemon) return s;
      const idx = op.bench.map((c, i) => ({ i, hp: (c.def?.hp || 0) - (c.damage || 0) })).sort((a, b) => a.hp - b.hp)[0].i;
      const incoming = op.bench[idx];
      op.bench = [...op.bench.filter((_, i) => i !== idx), { ...op.activePokemon, specialCondition: null }];
      op.activePokemon = { ...incoming, specialCondition: null };
      return pushLog(s, `Forced ${incoming.def?.name || "bench Pokémon"} into the Active spot.`);
    },
  },

  // ── Defensive ─
  {
    id: "shield_next_turn",
    label: "Reduce next attack vs you by N",
    category: "Defensive",
    description: "Until end of opponent's next turn, take N less damage.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 20, min: 0 }],
    run: (s, pk, p) => {
      const me = s[pk];
      if (!me?.activePokemon) return s;
      me.activePokemon.damageReductionUntilTurn = (s.turn || 0) + 1;
      me.activePokemon.damageReductionAmount = Number(p.amount || 0);
      return pushLog(s, `Will take ${p.amount} less damage until next turn.`);
    },
  },
  {
    id: "lock_opponent_attack",
    label: "Opponent can't attack next turn",
    category: "Defensive",
    description: "Opponent's Active can't attack on their next turn.",
    params: [],
    run: (s, pk) => {
      const op = s[opp(pk)];
      if (!op?.activePokemon) return s;
      op.activePokemon.cantAttackUntilTurn = (s.turn || 0) + 1;
      return pushLog(s, "Opponent locked next turn.");
    },
  },
  {
    id: "plus_power_self",
    label: "Buff your next attack",
    category: "Defensive",
    description: "+N damage to your next attack.",
    params: [{ key: "amount", type: PARAM_TYPES.number, default: 10, min: 0 }],
    run: (s, pk, p) => {
      const me = s[pk];
      if (!me?.activePokemon) return s;
      me.activePokemon.damageBonusNextAttack = (me.activePokemon.damageBonusNextAttack || 0) + Number(p.amount || 0);
      return pushLog(s, `+${p.amount} damage queued for next attack.`);
    },
  },

  // ── Marker / utility ─
  {
    id: "set_marker",
    label: "Set a custom marker",
    category: "Utility",
    description: "Stamp a named flag onto the attacker (read by guards).",
    params: [{ key: "name", type: PARAM_TYPES.text, default: "fired" }],
    run: (s, pk, p) => {
      const me = s[pk];
      if (!me?.activePokemon) return s;
      me.activePokemon.markers = { ...(me.activePokemon.markers || {}), [String(p.name || "fired")]: (s.turn || 0) };
      return pushLog(s, `Marker ${p.name} set.`);
    },
  },
];

// ── Guards ----------------------------------------------------------------
// Guards return a boolean — true means "run this primitive". The Mechanic
// Builder UI lets you stack any number of guards on a primitive, and the
// runtime ANDs them.
export const GUARDS = [
  {
    id: "if_energy_attached",
    label: "Only if energy of this type is attached",
    params: [
      { key: "type", type: PARAM_TYPES.energyType, default: "Darkness", options: ENERGY_TYPES },
      { key: "count", type: PARAM_TYPES.number, default: 1, min: 1 },
    ],
    evaluate: (s, pk, p) => {
      const types = activeEnergyTypes(s[pk]?.activePokemon);
      const have = types.filter((t) => t === p.type).length;
      return have >= Number(p.count || 1);
    },
  },
  {
    id: "if_first_turn",
    label: "Only on this Pokémon's first turn in play",
    params: [],
    evaluate: (s, pk) => {
      const ap = s[pk]?.activePokemon;
      if (!ap) return false;
      return (ap.turnPlayed || 0) === (s.turn || 0);
    },
  },
  {
    id: "if_active_no_ability",
    label: "Only if Active has no Ability",
    params: [],
    evaluate: (s, pk) => {
      const abilities = s[pk]?.activePokemon?.def?.abilities || [];
      return abilities.length === 0;
    },
  },
  {
    id: "if_defender_type",
    label: "Only if defender is this type",
    params: [
      { key: "type", type: PARAM_TYPES.energyType, default: "Water", options: ENERGY_TYPES },
    ],
    evaluate: (s, pk, p) => {
      const def = s[opp(pk)]?.activePokemon?.def;
      const t = String(def?.energy_type || "").toLowerCase();
      return t === String(p.type || "").toLowerCase();
    },
  },
  {
    id: "if_damage_counters_on",
    label: "Only if target has damage counters",
    params: [
      { key: "target", type: PARAM_TYPES.selfTarget, default: "defender", options: ["self", "defender"] },
      { key: "min", type: PARAM_TYPES.number, default: 1, min: 0 },
    ],
    evaluate: (s, pk, p) => {
      const mon = p.target === "self" ? s[pk]?.activePokemon : s[opp(pk)]?.activePokemon;
      const counters = Math.floor((mon?.damage || 0) / 10);
      return counters >= Number(p.min || 0);
    },
  },
  {
    id: "if_per_turn",
    label: "Cap N times per turn",
    params: [{ key: "count", type: PARAM_TYPES.number, default: 1, min: 1 }],
    // Pure check — no state mutation. The runtime calls `commit` only after
    // ALL guards pass and the primitive successfully runs, so a later guard
    // failing or the primitive throwing won't burn a charge.
    evaluate: (s, pk, p, ctx) => {
      const key = `${ctx.cardId}:${ctx.attackName}:per_turn`;
      const turn = s.turn || 0;
      const entry = s._mechanicCounters?.[key] || { turn: -1, n: 0 };
      const used = entry.turn === turn ? entry.n : 0;
      return used < Number(p.count || 1);
    },
    commit: (s, pk, p, ctx) => {
      const key = `${ctx.cardId}:${ctx.attackName}:per_turn`;
      const turn = s.turn || 0;
      s._mechanicCounters = s._mechanicCounters || {};
      const entry = s._mechanicCounters[key] || { turn: -1, n: 0 };
      const used = entry.turn === turn ? entry.n : 0;
      s._mechanicCounters[key] = { turn, n: used + 1 };
    },
  },
];

// ── Runtime ---------------------------------------------------------------
export function runMechanicConfig(state, pk, config, ctx = {}) {
  if (!config?.primitives?.length) return state;
  const ctx2 = { cardId: config.cardId, attackName: config.attackName, bonusDamage: ctx.bonusDamage || 0, ...ctx };
  let s = state;
  for (const entry of config.primitives) {
    const prim = PRIMITIVES.find((p) => p.id === entry.id);
    if (!prim) continue;
    const guards = entry.guards || [];
    const guardEntries = guards
      .map((g) => ({ entry: g, def: GUARDS.find((G) => G.id === g.id) }))
      .filter((x) => x.def);
    const allow = guardEntries.every(({ entry: g, def }) => {
      try { return Boolean(def.evaluate(s, pk, g.params || {}, ctx2)); }
      catch { return false; }
    });
    if (!allow) continue;
    let ranOk = false;
    try {
      s = prim.run(s, pk, entry.params || {}, ctx2) || s;
      ranOk = true;
    } catch (err) {
      pushLog(s, `Mechanic "${prim.label}" failed: ${err.message}`);
    }
    // Commit any guards that have a post-run side effect (e.g. if_per_turn
    // bumps the per-turn counter) only after the primitive itself ran. This
    // guarantees a charge is never consumed by a later guard's failure or
    // by a primitive that threw.
    if (ranOk) {
      for (const { entry: g, def } of guardEntries) {
        if (typeof def.commit !== "function") continue;
        try { def.commit(s, pk, g.params || {}, ctx2); }
        catch { /* swallow — commits are best-effort */ }
      }
    }
  }
  state.bonusDamage = ctx2.bonusDamage; // surface so engine can read it
  return s;
}

export function getPrimitiveById(id) {
  return PRIMITIVES.find((p) => p.id === id) || null;
}
export function getGuardById(id) {
  return GUARDS.find((g) => g.id === id) || null;
}

// Static metadata used by the UI for chip colors / sectioning.
export const PRIMITIVE_CATEGORIES = ["Damage", "Healing", "Status", "Energy", "Tempo", "Position", "Defensive", "Utility"];
