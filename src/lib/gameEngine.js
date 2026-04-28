// ============================================================
// POKÉMON TCG GAME ENGINE - Full Rules Implementation
// ============================================================
// Covers: prize cards, bench (5 slots), active Pokémon,
// energy attachment (1/turn), evolutions, trainer cards,
// special conditions (poisoned, burned, confused, paralyzed, asleep),
// coin flips, weakness/resistance, retreat cost, abilities,
// win conditions, and a skeleton for every trainer archetype.
// ============================================================

import { resolveCustomMechanic, CUSTOM_MECHANICS } from "./customMechanics";
import { SPECIAL_CONDITIONS, ENERGY_TYPES } from "./gameConstants.js";
export { SPECIAL_CONDITIONS, ENERGY_TYPES } from "./gameConstants.js";

// ── Coin flip ──────────────────────────────────────────────
export function coinFlip() {
  return Math.random() < 0.5 ? "heads" : "tails";
}

export function flipCoins(n) {
  return Array.from({ length: n }, () => coinFlip());
}

// ── Deck operations ────────────────────────────────────────
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Create a fresh in-play card instance ───────────────────
export function createPlayCard(cardDef, instanceId) {
  return {
    instanceId,
    def: cardDef,           // original card definition
    damage: 0,              // damage counters on this card
    energyAttached: [],     // array of energy card instanceIds attached
    specialCondition: null, // one of SPECIAL_CONDITIONS values
    toolAttached: null,     // tool card instanceId
    poisonCounters: 1,      // 1 for poisoned, 3 for badly poisoned
    burnFlips: 0,           // for burn between turns
    isEvolved: false,
    evolvedFromInstanceId: null,
    turnPlayed: null,       // turn number this was put into play (for evolution restriction)
    attackedThisTurn: false,
    abilityUsedThisTurn: false,
    retreatedThisTurn: false,
    // Classic-era effect flags. Expire in endTurn() once the
    // guard turn has passed.
    preventEffectsUntilTurn: 0,   // Agility-style: ignore damage + effects from opponent attacks
    cantAttackUntilTurn: 0,       // Lock-style: opponent can't attack next turn
    damageBonusNextAttack: 0,     // PlusPower, Defender, etc.
  };
}

// ── Initialize a player's side ─────────────────────────────
export function createPlayerState(playerDef) {
  const deck = shuffle(playerDef.deck.map((card, i) =>
    createPlayCard(card, `${playerDef.id}-${i}`)
  ));

  // Draw 7 cards; if no basic Pokémon, mulligan (shuffle back, draw again, give opponent +1 card option)
  let hand = [];
  let mulligans = 0;
  let remaining = [...deck];

  while (true) {
    hand = remaining.slice(0, 7);
    remaining = remaining.slice(7);
    const hasBasic = hand.some(c => c.def.supertype === "Pokémon" && c.def.stage === "basic");
    if (hasBasic) break;
    // Mulligan: put hand back, reshuffle, redraw
    remaining = shuffle([...remaining, ...hand]);
    mulligans++;
    if (mulligans > 10) break; // safety
  }

  const prizeCards = remaining.slice(0, 6);
  const drawPile = remaining.slice(6);

  // Auto-set up the first Basic from the starting hand as the Active Pokémon
  // so the game can start without a dedicated setup phase. (Classic TCG would
  // let the player choose; we pick the first Basic in hand order, which is
  // deterministic and never mulligans.) Any additional Basics can be played
  // to the bench by the player on their first turn.
  let activePokemon = null;
  let workingHand = [...hand];
  const firstBasicIdx = workingHand.findIndex(c => c.def.supertype === "Pokémon" && c.def.stage === "basic");
  if (firstBasicIdx !== -1) {
    activePokemon = { ...workingHand[firstBasicIdx], turnPlayed: 0 };
    workingHand = [
      ...workingHand.slice(0, firstBasicIdx),
      ...workingHand.slice(firstBasicIdx + 1),
    ];
  }

  return {
    id: playerDef.id,
    name: playerDef.name,
    hand: workingHand,
    deck: drawPile,
    discard: [],
    prizeCards,              // face-down prize pile (6 cards)
    activePokemon,           // auto-placed Basic from hand, or null if none
    bench: [],               // up to 5 playCards
    stadium: null,           // active stadium card
    supporterPlayedThisTurn: false,
    energyAttachedThisTurn: false,
    mulligans,
  };
}

// ── Full game state ────────────────────────────────────────
// Optional `opts.firstPlayer` ("player1" | "player2") lets the caller override
// the coin toss — e.g. when replaying a sync'd seed from the network so both
// clients derive the same start state, or when the winner of the toss has
// chosen to go second. If omitted, a fair coin flip picks the first player.
export function createGameState(p1Def, p2Def, mode = "unlimited", opts = {}) {
  const flip = opts.flip || coinFlip();
  // `tossWinner` is who won the flip; `firstPlayer` is who *actually* moves
  // first (defaults to tossWinner but can be overridden if the winner chose
  // to go second — `opts.firstPlayer`).
  const tossWinner = flip === "heads" ? "player1" : "player2";
  const firstPlayer = opts.firstPlayer || tossWinner;
  return {
    mode,
    turn: 1,
    phase: "main",        // setup | main | attack | end | finished (setup is auto-resolved in createPlayerState)
    activePlayer: firstPlayer,
    player1: createPlayerState({ ...p1Def, id: "player1" }),
    player2: createPlayerState({ ...p2Def, id: "player2" }),
    winner: null,
    log: [
      `Coin flip: ${flip} — ${tossWinner === "player1" ? p1Def.name : p2Def.name} wins the toss.`,
      `${firstPlayer === "player1" ? p1Def.name : p2Def.name} goes first!`,
    ],
    coinFlipResults: [],
    lastAction: null,
    // Monotonically-increasing version used by multiplayerSync to pick the
    // authoritative snapshot when two clients diverge mid-turn.
    stateVersion: 0,
    // Surfaced so the UI can play the toss animation and let the winner
    // choose to go first or second. `awaitingChoice` starts true unless
    // the caller explicitly passed `opts.firstPlayer` (e.g. from network
    // sync or deterministic replay).
    initialCoinToss: {
      flip,            // "heads" | "tails"
      tossWinner,      // "player1" | "player2"
      firstPlayer,     // "player1" | "player2"
      awaitingChoice: !opts.firstPlayer,
      chosen: opts.firstPlayer ? (opts.firstPlayer === tossWinner ? "first" : "second") : null,
    },
  };
}

// Apply the coin-toss winner's "go first" / "go second" choice. Called from
// the UI once the toss overlay is dismissed. Idempotent — re-running with
// the same choice is safe.
export function resolveCoinTossChoice(gs, choice) {
  if (!gs?.initialCoinToss) return gs;
  const { tossWinner } = gs.initialCoinToss;
  const firstPlayer = choice === "first"
    ? tossWinner
    : (tossWinner === "player1" ? "player2" : "player1");
  return {
    ...gs,
    activePlayer: firstPlayer,
    stateVersion: (gs.stateVersion || 0) + 1,
    log: [
      ...(gs.log || []),
      `${gs[tossWinner]?.name || tossWinner} chose to go ${choice}.`,
    ],
    initialCoinToss: {
      ...gs.initialCoinToss,
      firstPlayer,
      chosen: choice,
      awaitingChoice: false,
    },
  };
}

// Every public action routes through this so network clients can use
// stateVersion to adopt the freshest authoritative snapshot without needing
// to diff the full state tree.
export function bumpVersion(gs) {
  if (!gs) return gs;
  return { ...gs, stateVersion: (gs.stateVersion || 0) + 1 };
}

// ── Getters ────────────────────────────────────────────────
export function getActivePlayer(gs) {
  return gs[gs.activePlayer];
}

export function getOpponent(gs) {
  return gs[gs.activePlayer === "player1" ? "player2" : "player1"];
}

export function getOpponentKey(gs) {
  return gs.activePlayer === "player1" ? "player2" : "player1";
}

// ── Draw cards ────────────────────────────────────────────
export function drawCards(playerState, n = 1) {
  const drawn = playerState.deck.slice(0, n);
  return {
    ...playerState,
    hand: [...playerState.hand, ...drawn],
    deck: playerState.deck.slice(n),
  };
}

// ── Check win conditions ───────────────────────────────────
export function checkWinConditions(gs) {
  const p1 = gs.player1;
  const p2 = gs.player2;

  // Prize cards all taken
  if (p1.prizeCards.length === 0) return { winner: "player1", reason: "All prize cards taken" };
  if (p2.prizeCards.length === 0) return { winner: "player2", reason: "All prize cards taken" };

  // No active Pokémon and no bench
  if (!p1.activePokemon && p1.bench.length === 0) return { winner: "player2", reason: "No Pokémon left" };
  if (!p2.activePokemon && p2.bench.length === 0) return { winner: "player1", reason: "No Pokémon left" };

  // Deck out (tried to draw but couldn't)
  if (p1.deck.length === 0 && p1.hand.length === 0) return { winner: "player2", reason: "Deck out" };
  if (p2.deck.length === 0 && p2.hand.length === 0) return { winner: "player1", reason: "Deck out" };

  return null;
}

// ── Calculate damage with weakness / resistance ────────────
export function calcDamage(attacker, defender, baseDamage, gs = null) {
  let dmg = baseDamage;

  // Weakness (usually ×2)
  const weaknesses = defender.def.weaknesses || [];
  for (const w of weaknesses) {
    if (attacker.def.types?.includes(w.type)) {
      if (w.value.startsWith("×")) dmg *= parseInt(w.value.slice(1));
      else if (w.value.startsWith("+")) dmg += parseInt(w.value.slice(1));
    }
  }

  // Resistance (usually -30)
  const resistances = defender.def.resistances || [];
  for (const r of resistances) {
    if (attacker.def.types?.includes(r.type)) {
      if (r.value.startsWith("-")) dmg -= parseInt(r.value.slice(1));
    }
  }

  // Per-defender damage-reduction shield set by an earlier attack
  // (e.g. "any damage done to this Pokémon by attacks is reduced by 20").
  // Honored only while the shield is still active relative to the current turn.
  const turn = gs?.turn ?? 0;
  if ((defender.damageReductionUntilTurn || 0) >= turn) {
    const reduction = defender.damageReductionAmount || 0;
    if (reduction > 0) dmg = Math.max(0, dmg - reduction);
  }

  return Math.max(0, dmg);
}

// ── Check if a Pokémon is Knocked Out ─────────────────────
export function isKnockedOut(playCard) {
  return playCard.def.hp && playCard.damage >= playCard.def.hp;
}

// ── Auto-promote the best bench Pokémon to Active when Active
// is missing (or KO'd). Best = most remaining HP, then most
// energy attached. Returns the updated playerState (pure).
export function autoPromoteActive(playerState) {
  if (!playerState) return playerState;
  if (playerState.activePokemon && !isKnockedOut(playerState.activePokemon)) {
    return playerState;
  }
  if (!playerState.bench || playerState.bench.length === 0) {
    return playerState;
  }
  const scored = playerState.bench
    .map((c) => ({
      c,
      hp: (c.def?.hp || 0) - (c.damage || 0),
      energy: c.energyAttached?.length || 0,
    }))
    .sort((a, b) => b.hp - a.hp || b.energy - a.energy);
  const chosen = scored[0].c;
  return {
    ...playerState,
    activePokemon: { ...chosen, specialCondition: null },
    bench: playerState.bench.filter((c) => c.instanceId !== chosen.instanceId),
  };
}

// Run auto-promote for both players. Useful after any state mutation.
export function autoPromoteAll(gs) {
  if (!gs) return gs;
  return {
    ...gs,
    player1: autoPromoteActive(gs.player1),
    player2: autoPromoteActive(gs.player2),
  };
}

// ── Energy semantics — basic vs special energy.
// Special energies provide more than one Colorless or stand in for any type.
// `provides` is a list of energy-type buckets the card contributes when paying
// an attack cost. Buckets:
//   • A specific basic type ("Fire", "Water", …) — counts toward that type AND
//     toward Colorless. (Example: a Fire energy can pay 1 Fire OR 1 Colorless.)
//   • "Colorless" — only pays Colorless cost.
//   • "Rainbow" — counts as ANY type (basic + colorless). Bookkept as "Any"
//     and resolved by the matcher below.
function energyProvides(energyCard) {
  if (!energyCard) return ["Colorless"];
  const def = energyCard.def || energyCard;
  const name = String(def.name || "").toLowerCase();
  const subtypes = (def.subtypes || []).map((s) => String(s).toLowerCase());
  const isSpecial = subtypes.includes("special") || (subtypes.length && !subtypes.includes("basic"));

  // Rainbow / multi-type — counts as one of any type.
  if (name.includes("rainbow")) return ["Any"];
  // Double Colorless — pays 2 Colorless. Iconic Hitmonchan / Mr. Mime fuel.
  if (name.includes("double colorless")) return ["Colorless", "Colorless"];
  // Twin / Boost / Scramble / Powerful pays for an attack cost mix; we
  // approximate as one of each major type so it can satisfy any single
  // typed cost the attacker needs.
  if (isSpecial && (name.includes("twin") || name.includes("scramble") || name.includes("boost"))) {
    return ["Any"];
  }

  // Map by name to a single basic-energy type for everything else.
  const map = [
    ["fire", "Fire"], ["water", "Water"], ["grass", "Grass"],
    ["lightning", "Lightning"], ["electric", "Lightning"],
    ["psychic", "Psychic"], ["fighting", "Fighting"],
    ["darkness", "Darkness"], ["dark", "Darkness"],
    ["metal", "Metal"], ["steel", "Metal"],
    ["dragon", "Dragon"], ["fairy", "Fairy"],
  ];
  for (const [token, t] of map) {
    if (name.includes(token)) return [t];
  }
  return ["Colorless"];
}

function flattenProvides(attached) {
  const out = [];
  for (const e of attached || []) for (const t of energyProvides(e)) out.push(t);
  return out;
}

// ── Count energy of a type attached ───────────────────────
export function countEnergy(playCard, type = null) {
  const buckets = flattenProvides(playCard.energyAttached);
  if (!type) return buckets.length;
  if (type === "Colorless") return buckets.length; // anything pays Colorless
  return buckets.filter((t) => t === type || t === "Any").length;
}

// ── Check if an attack's energy cost is met ───────────────
export function canAffordAttack(attacker, attack) {
  const costMap = {};
  for (const c of attack.cost) costMap[c] = (costMap[c] || 0) + 1;
  // Count buckets contributed by every attached card. Special energies expand
  // into multiple buckets here (DCE → ["Colorless","Colorless"], Rainbow →
  // ["Any"]) so the matcher below treats them correctly without per-card
  // special-cases.
  const buckets = flattenProvides(attacker.energyAttached);
  const available = { Any: 0 };
  for (const t of ENERGY_TYPES) available[t] = 0;
  for (const t of buckets) available[t] = (available[t] || 0) + 1;

  const remaining = { ...costMap };
  // Satisfy specific typed costs first (not Colorless).
  for (const type of ENERGY_TYPES) {
    if (type === "Colorless") continue;
    let need = remaining[type] || 0;
    if (need <= 0) continue;
    const direct = Math.min(need, available[type] || 0);
    available[type] -= direct;
    need -= direct;
    if (need > 0 && (available.Any || 0) > 0) {
      const fromAny = Math.min(need, available.Any);
      available.Any -= fromAny;
      need -= fromAny;
    }
    remaining[type] = need;
  }
  // Any leftover specific need can't be paid.
  for (const type of ENERGY_TYPES) {
    if (type === "Colorless") continue;
    if ((remaining[type] || 0) > 0) return false;
  }
  // Colorless can be paid by anything left over.
  const colorlessNeed = remaining["Colorless"] || 0;
  const totalLeft = Object.values(available).reduce((a, b) => a + b, 0);
  return colorlessNeed <= totalLeft;
}

// ── Between-turn special condition effects ─────────────────
export function applyBetweenTurnEffects(playerState, log) {
  let ps = { ...playerState };
  if (!ps.activePokemon) return { playerState: ps, log };
  let ap = { ...ps.activePokemon };
  const newLog = [...log];

  // Poison: 1 damage counter (10 damage)
  if (ap.specialCondition === SPECIAL_CONDITIONS.POISONED) {
    ap.damage += 10;
    newLog.push(`${ap.def.name} took 10 poison damage.`);
  }

  // Badly Poisoned: increasing counters
  if (ap.specialCondition === SPECIAL_CONDITIONS.BADLY_POISONED) {
    const dmg = ap.poisonCounters * 10;
    ap.damage += dmg;
    ap.poisonCounters += 1;
    newLog.push(`${ap.def.name} took ${dmg} badly poison damage.`);
  }

  // Burn: flip 2 coins; if both tails, 20 damage; else remove burn
  if (ap.specialCondition === SPECIAL_CONDITIONS.BURNED) {
    const flips = flipCoins(2);
    newLog.push(`Burn check: ${flips.join(", ")}`);
    if (flips.every(f => f === "tails")) {
      ap.damage += 20;
      newLog.push(`${ap.def.name} took 20 burn damage.`);
    } else {
      ap.specialCondition = null;
      newLog.push(`${ap.def.name}'s burn was healed.`);
    }
  }

  // Asleep: flip coin to wake up
  if (ap.specialCondition === SPECIAL_CONDITIONS.ASLEEP) {
    const flip = coinFlip();
    newLog.push(`Sleep check: ${flip}`);
    if (flip === "heads") {
      ap.specialCondition = null;
      newLog.push(`${ap.def.name} woke up!`);
    }
  }

  // Paralyzed: remove after one turn
  if (ap.specialCondition === SPECIAL_CONDITIONS.PARALYZED) {
    ap.specialCondition = null;
    newLog.push(`${ap.def.name} is no longer paralyzed.`);
  }

  ps.activePokemon = ap;
  return { playerState: ps, log: newLog };
}

// ── ACTIONS ────────────────────────────────────────────────
// Each action returns { gameState, success, error, log }

// Play a Basic Pokémon to bench
export function playBasicToBench(gs, playerKey, cardInstanceId) {
  const ps = { ...gs[playerKey] };
  const card = ps.hand.find(c => c.instanceId === cardInstanceId);

  if (!card) return { ...gs, _error: "Card not in hand" };
  if (card.def.supertype !== "Pokémon" || card.def.stage !== "basic") return { ...gs, _error: "Not a Basic Pokémon" };
  if (ps.bench.length >= 5) return { ...gs, _error: "Bench is full" };

  const playCard = { ...card, turnPlayed: gs.turn };
  return {
    ...gs,
    [playerKey]: {
      ...ps,
      hand: ps.hand.filter(c => c.instanceId !== cardInstanceId),
      bench: [...ps.bench, playCard],
    },
    log: [...gs.log, `${ps.name} played ${card.def.name} to bench.`],
  };
}

// Set active Pokémon from bench (or hand during setup)
export function setActivePokemon(gs, playerKey, cardInstanceId) {
  const ps = { ...gs[playerKey] };
  const fromBench = ps.bench.find(c => c.instanceId === cardInstanceId);
  const fromHand = ps.hand.find(c => c.instanceId === cardInstanceId);
  const card = fromBench || fromHand;

  if (!card) return { ...gs, _error: "Card not found" };
  if (ps.activePokemon) return { ...gs, _error: "Already have active Pokémon" };

  const source = fromBench ? "bench" : "hand";
  return {
    ...gs,
    [playerKey]: {
      ...ps,
      activePokemon: { ...card, turnPlayed: gs.turn },
      hand: source === "hand" ? ps.hand.filter(c => c.instanceId !== cardInstanceId) : ps.hand,
      bench: source === "bench" ? ps.bench.filter(c => c.instanceId !== cardInstanceId) : ps.bench,
    },
    log: [...gs.log, `${ps.name} set ${card.def.name} as Active.`],
  };
}

// Attach energy (1 per turn)
export function attachEnergy(gs, playerKey, energyInstanceId, targetInstanceId) {
  const ps = { ...gs[playerKey] };
  if (ps.energyAttachedThisTurn) return { ...gs, _error: "Already attached energy this turn" };

  const energyCard = ps.hand.find(c => c.instanceId === energyInstanceId);
  if (!energyCard || energyCard.def.supertype !== "Energy") return { ...gs, _error: "Not an energy card" };

  // Find target (active or bench)
  let newGs = { ...gs };
  let target = null;

  if (ps.activePokemon?.instanceId === targetInstanceId) {
    target = { ...ps.activePokemon, energyAttached: [...ps.activePokemon.energyAttached, energyCard] };
    newGs = {
      ...newGs,
      [playerKey]: {
        ...ps,
        activePokemon: target,
        hand: ps.hand.filter(c => c.instanceId !== energyInstanceId),
        energyAttachedThisTurn: true,
      },
    };
  } else {
    const benchIdx = ps.bench.findIndex(c => c.instanceId === targetInstanceId);
    if (benchIdx === -1) return { ...gs, _error: "Target not found" };
    const newBench = [...ps.bench];
    newBench[benchIdx] = { ...newBench[benchIdx], energyAttached: [...newBench[benchIdx].energyAttached, energyCard] };
    newGs = {
      ...newGs,
      [playerKey]: {
        ...ps,
        bench: newBench,
        hand: ps.hand.filter(c => c.instanceId !== energyInstanceId),
        energyAttachedThisTurn: true,
      },
    };
  }

  return { ...newGs, log: [...newGs.log, `${ps.name} attached ${energyCard.def.name} to ${target?.def.name || "a Pokémon"}.`] };
}

// Evolve a Pokémon
export function evolvePokemon(gs, playerKey, evolutionCardInstanceId, targetInstanceId) {
  const ps = { ...gs[playerKey] };
  const evoCard = ps.hand.find(c => c.instanceId === evolutionCardInstanceId);
  if (!evoCard) return { ...gs, _error: "Evolution card not in hand" };
  if (evoCard.def.supertype !== "Pokémon") return { ...gs, _error: "Not a Pokémon" };

  const isActive = ps.activePokemon?.instanceId === targetInstanceId;
  const benchIdx = ps.bench.findIndex(c => c.instanceId === targetInstanceId);
  const target = isActive ? ps.activePokemon : ps.bench[benchIdx];

  if (!target) return { ...gs, _error: "Target not found" };
  if (target.turnPlayed === gs.turn) return { ...gs, _error: "Cannot evolve a Pokémon played this turn" };
  if (evoCard.def.evolvesFrom !== target.def.name) return { ...gs, _error: `${evoCard.def.name} doesn't evolve from ${target.def.name}` };

  const evolved = {
    ...target,
    def: evoCard.def,
    damage: target.damage,
    energyAttached: target.energyAttached,
    toolAttached: target.toolAttached,
    specialCondition: null, // evolving removes special conditions
    isEvolved: true,
    evolvedFromInstanceId: target.instanceId,
    instanceId: evoCard.instanceId,
    turnPlayed: gs.turn,
  };

  let newPs = { ...ps, hand: ps.hand.filter(c => c.instanceId !== evolutionCardInstanceId) };
  if (isActive) {
    newPs.activePokemon = evolved;
  } else {
    const newBench = [...ps.bench];
    newBench[benchIdx] = evolved;
    newPs.bench = newBench;
  }

  return {
    ...gs,
    [playerKey]: newPs,
    log: [...gs.log, `${ps.name} evolved ${target.def.name} into ${evoCard.def.name}!`],
  };
}

// Retreat active Pokémon
export function retreat(gs, playerKey, newActiveInstanceId, energyToDiscardIds) {
  const ps = { ...gs[playerKey] };
  const active = ps.activePokemon;
  if (!active) return { ...gs, _error: "No active Pokémon" };
  if (ps.retreatedThisTurn) return { ...gs, _error: "Already retreated this turn" };
  if (active.specialCondition === SPECIAL_CONDITIONS.PARALYZED) return { ...gs, _error: "Paralyzed Pokémon can't retreat" };
  if (active.specialCondition === SPECIAL_CONDITIONS.ASLEEP) return { ...gs, _error: "Asleep Pokémon can't retreat" };

  const retreatCost = active.def.convertedRetreatCost || 0;
  if (energyToDiscardIds.length < retreatCost) return { ...gs, _error: `Need to discard ${retreatCost} energy to retreat` };

  const newActive = ps.bench.find(c => c.instanceId === newActiveInstanceId);
  if (!newActive) return { ...gs, _error: "New active not on bench" };

  const remainingEnergy = active.energyAttached.filter(e => !energyToDiscardIds.includes(e.instanceId));
  const discardedEnergy = active.energyAttached.filter(e => energyToDiscardIds.includes(e.instanceId));

  const retreatedPokemon = { ...active, energyAttached: remainingEnergy, specialCondition: null };
  const newBench = [
    ...ps.bench.filter(c => c.instanceId !== newActiveInstanceId),
    retreatedPokemon,
  ];

  return {
    ...gs,
    [playerKey]: {
      ...ps,
      activePokemon: newActive,
      bench: newBench,
      discard: [...ps.discard, ...discardedEnergy],
      retreatedThisTurn: true,
    },
    log: [...gs.log, `${ps.name} retreated ${active.def.name}, sent out ${newActive.def.name}.`],
  };
}

// ── Resolve a prompt-driven attack into damage / self-damage ─
// Called from `performAttack` after the player has answered the
// attack's prompt (Birthday Pikachu yes/no, Unown height guess,
// Rock-Paper-Scissors throw). Returns `{ damage, self_damage, log }`
// describing the per-attack effect — the engine then plugs damage
// into the normal calc pipeline.
export function resolveAttackPrompt(prompt, answer, defender) {
  if (!prompt) return null;
  const ans = answer || {};
  if (prompt.kind === "birthday") {
    const isBirthday = Boolean(ans.isBirthday ?? ans.birthday);
    const branch = isBirthday ? prompt.on_yes : prompt.on_no;
    return {
      damage: branch?.damage ?? 0,
      self_damage: branch?.self_damage ?? 0,
      log: isBirthday
        ? "Happy birthday! Birthday Surprise lands."
        : "Not your birthday — the attack does nothing.",
    };
  }
  if (prompt.kind === "height-guess") {
    const target = Number(defender?.def?.height_m ?? 1.0);
    const guess = Number(ans.guess);
    if (!Number.isFinite(guess)) {
      return { damage: 0, log: "No guess provided — the attack does nothing." };
    }
    const distance = Math.abs(guess - target);
    const tiers = Array.isArray(prompt.tiers) ? prompt.tiers : [];
    for (const tier of tiers) {
      if (distance <= Number(tier.within)) {
        return {
          damage: tier.damage ?? 0,
          self_damage: tier.self_damage ?? 0,
          log: `Guessed ${guess.toFixed(2)}m vs actual ${target.toFixed(2)}m — off by ${distance.toFixed(2)}m.`,
        };
      }
    }
    return { damage: 0, log: `Guessed ${guess.toFixed(2)}m vs actual ${target.toFixed(2)}m — off by ${distance.toFixed(2)}m.` };
  }
  if (prompt.kind === "rps") {
    const me = String(ans.choice || "").toLowerCase();
    const choices = ["rock", "paper", "scissors"];
    if (!choices.includes(me)) return { damage: 0, log: "No throw chosen." };
    const opp = ans.opponentChoice && choices.includes(String(ans.opponentChoice).toLowerCase())
      ? String(ans.opponentChoice).toLowerCase()
      : choices[Math.floor(Math.random() * 3)];
    const wins =
      (me === "rock" && opp === "scissors") ||
      (me === "paper" && opp === "rock") ||
      (me === "scissors" && opp === "paper");
    let branch;
    if (me === opp) branch = prompt.tie;
    else if (wins) branch = prompt.win;
    else branch = prompt.lose;
    return {
      damage: branch?.damage ?? 0,
      self_damage: branch?.self_damage ?? 0,
      log: `You threw ${me}, opponent threw ${opp} — ${
        me === opp ? "tie" : wins ? "you win" : "you lose"
      }.`,
    };
  }
  return null;
}

// ── ATTACK ─────────────────────────────────────────────────
export function performAttack(gs, attackIndex, options = {}) {
  const playerKey = gs.activePlayer;
  const oppKey = getOpponentKey(gs);
  let ps = { ...gs[playerKey] };
  let opp = { ...gs[oppKey] };
  const attacker = ps.activePokemon;
  const defender = opp.activePokemon;
  const newLog = [...gs.log];
  let newGs = { ...gs };

  if (!attacker) return { ...gs, _error: "No active Pokémon" };
  if (!defender) return { ...gs, _error: "Opponent has no active Pokémon" };
  if (attacker.specialCondition === SPECIAL_CONDITIONS.PARALYZED) return { ...gs, _error: "Paralyzed — can't attack" };
  if (attacker.specialCondition === SPECIAL_CONDITIONS.ASLEEP) return { ...gs, _error: "Asleep — can't attack" };
  // Lock-style effects from the opponent's previous attack (e.g. "The Defending
  // Pokémon can't attack during your opponent's next turn").
  if ((attacker.cantAttackUntilTurn || 0) >= gs.turn) {
    return { ...gs, _error: `${attacker.def.name} can't attack this turn` };
  }

  const attack = attacker.def.attacks?.[attackIndex];
  if (!attack) return { ...gs, _error: "Attack not found" };
  if (!canAffordAttack(attacker, attack)) return { ...gs, _error: "Not enough energy" };

  // ── Prompt-based attacks (Birthday Pikachu, Unown height-guess,
  // Rock-Paper-Scissors, etc.) — short-circuit to surface a pending
  // prompt to the UI; the player calls performAttack again with
  // `options.promptAnswer` to resume resolution.
  if (attack.prompt && options.promptAnswer === undefined) {
    return {
      ...gs,
      pendingAttack: {
        playerKey,
        attackIndex,
        attackName: attack.name,
        prompt: attack.prompt,
        defenderName: defender?.def?.name || "the Defending Pokémon",
        defenderHeight: defender?.def?.height_m ?? 1.0,
      },
    };
  }
  // Drop any stale pending prompt now that we're resuming.
  if (gs.pendingAttack) {
    newGs = { ...newGs, pendingAttack: null };
  }
  // Resolve the prompt's answer into per-shot effects (damage override,
  // self-damage). Falls through to the normal attack loop below.
  const promptEffect = attack.prompt
    ? resolveAttackPrompt(attack.prompt, options.promptAnswer, defender)
    : null;

  // Confused: flip coin; tails = 30 damage to self instead
  if (attacker.specialCondition === SPECIAL_CONDITIONS.CONFUSED) {
    const flip = coinFlip();
    newLog.push(`Confusion check: ${flip}`);
    if (flip === "tails") {
      const selfDmg = 30;
      newLog.push(`${attacker.def.name} hurt itself in confusion for ${selfDmg}!`);
      const newAttacker = { ...attacker, damage: attacker.damage + selfDmg };
      if (isKnockedOut(newAttacker)) {
        newLog.push(`${newAttacker.def.name} was Knocked Out!`);
        ps.discard = [...ps.discard, newAttacker, ...newAttacker.energyAttached];
        if (newAttacker.toolAttached) ps.discard.push(newAttacker.toolAttached);
        ps.activePokemon = null;
        // Opponent takes prizes
        const prizesTaken = getPrizesForKO(newAttacker);
        const oppPrizes = opp.prizeCards.slice(0, prizesTaken);
        opp.hand = [...opp.hand, ...oppPrizes];
        opp.prizeCards = opp.prizeCards.slice(prizesTaken);
        newLog.push(`${opp.name} took ${prizesTaken} Prize card(s)!`);
      } else {
        ps.activePokemon = newAttacker;
      }
      let confGs = autoPromoteAll({ ...newGs, [playerKey]: ps, [oppKey]: opp, log: newLog });
      const confWin = checkWinConditions(confGs);
      if (confWin) {
        return { ...confGs, winner: confWin.winner, phase: "finished", log: [...confGs.log, `${confWin.winner} wins! ${confWin.reason}`] };
      }
      return endTurn(confGs);
    }
  }

  // Calculate damage
  let baseDmg = attack.damageValue || 0;
  // Prompt-driven attacks (Birthday / Unown / RPS) override the printed damage
  // value with whatever the answered prompt resolved to.
  if (promptEffect && typeof promptEffect.damage === "number") {
    baseDmg = promptEffect.damage;
    if (promptEffect.log) newLog.push(promptEffect.log);
  }
  // PlusPower / Defender-style stacked modifier applied by trainers earlier this turn.
  const preAttackBonus = attacker.damageBonusNextAttack || 0;
  baseDmg += preAttackBonus;
  let finalDmg = calcDamage(attacker, defender, baseDmg, gs);

  // Agility / "prevent all effects of attacks" flag on the defender — drops
  // damage and blocks status riders for the current turn.
  const defenderProtected = (defender.preventEffectsUntilTurn || 0) >= gs.turn;
  if (defenderProtected) {
    newLog.push(`${attacker.def.name} used ${attack.name}, but ${defender.def.name} is protected this turn!`);
    finalDmg = 0;
  } else {
    newLog.push(`${attacker.def.name} used ${attack.name}${finalDmg > 0 ? ` for ${finalDmg} damage` : ""}!`);
  }

  // Apply attack text effects (skeleton — expand per card). When the defender
  // is protected (Agility-style "prevent all effects of attacks done to this
  // Pokémon") the protection applies only to the defender itself — status,
  // locks, and energy discard targeting THIS Pokémon are dropped. Effects
  // that hit the rest of the opponent's side (bench damage, mill, hand
  // discard) still land because they aren't done "to this Pokémon". We do
  // this by snapshotting the pre-resolver defender and, post-resolver,
  // restoring only `opp.activePokemon` while keeping `opp.bench/deck/hand`
  // mutations from the resolver.
  const preResolverDefender = defenderProtected ? structuredClone(defender) : null;
  const effects = resolveAttackText(attack, attacker, defender, finalDmg, ps, opp, newLog, gs);
  finalDmg = defenderProtected ? 0 : effects.damage;
  ps = effects.ps;
  opp = effects.opp;
  if (defenderProtected) {
    // Restore defender active card; then un-duplicate any of its energy that
    // the resolver moved into opp.discard (since we're putting it back).
    const preIds = new Set((preResolverDefender?.energyAttached || []).map(e => e.instanceId));
    const postIds = new Set((opp.activePokemon?.energyAttached || []).map(e => e.instanceId));
    const movedIds = [...preIds].filter(id => !postIds.has(id));
    if (movedIds.length > 0) {
      opp.discard = opp.discard.filter(c => !movedIds.includes(c.instanceId));
    }
    opp.activePokemon = preResolverDefender;
  }
  newLog.push(...effects.extraLog);

  // Consume the one-shot damage bonus regardless of outcome.
  if (preAttackBonus > 0 && ps.activePokemon) {
    ps.activePokemon = { ...ps.activePokemon, damageBonusNextAttack: 0 };
  }

  // Defender trainer / other incoming damage reducers. Consumed on hit.
  const reduction = defender.damageReduction || 0;
  if (reduction > 0 && finalDmg > 0) {
    const reduced = Math.max(0, finalDmg - reduction);
    if (reduced !== finalDmg) {
      newLog.push(`Damage reduced by ${finalDmg - reduced} (Defender).`);
      finalDmg = reduced;
    }
  }

  // Apply damage. `opp.activePokemon` is either the resolver-mutated defender
  // (normal path) or the pre-resolver defender (protected path — see above).
  // Protected defenders also take 0 damage because `finalDmg` was zeroed.
  const currentDefender = opp.activePokemon || defender;
  let newDefender = defenderProtected
    ? { ...currentDefender }
    : { ...currentDefender, damage: currentDefender.damage + finalDmg, damageReduction: 0 };
  opp.activePokemon = newDefender;

  // ── Custom mechanic hook ─────────────────────────────────
  // Attacks can reference a registered mechanic id (see
  // src/lib/customMechanics.js) which runs after base damage.
  // Supported keys: attack.custom_mechanic_id (single) or
  // attack.custom_mechanics (array of { id, opts }).
  const mechEntries = [];
  if (attack.custom_mechanic_id) mechEntries.push({ id: attack.custom_mechanic_id, opts: attack.custom_mechanic_opts || {} });
  if (Array.isArray(attack.custom_mechanics)) {
    for (const m of attack.custom_mechanics) {
      if (m?.id) mechEntries.push({ id: m.id, opts: m.opts || {} });
    }
  }
  // Runtime Mechanic Builder lookup — picks up configs saved after the
  // card was hydrated into the registry, so authoring in MechanicBuilder
  // is reflected immediately without a page reload.
  const cardId = attacker?.def?.id;
  const attackName = attack?.name;
  if (cardId && attackName) {
    const exact = `card-mechanic:${cardId}:${attackName}`;
    const wildcard = `card-mechanic:${cardId}:*`;
    if (CUSTOM_MECHANICS[exact] && !mechEntries.some((m) => m.id === exact)) {
      mechEntries.push({ id: exact, opts: {} });
    }
    if (CUSTOM_MECHANICS[wildcard] && !mechEntries.some((m) => m.id === wildcard)) {
      mechEntries.push({ id: wildcard, opts: {} });
    }
  }
  if (mechEntries.length) {
    let mechGs = { ...gs, [playerKey]: ps, [oppKey]: opp };
    for (const { id, opts } of mechEntries) {
      try {
        const result = resolveCustomMechanic(id, mechGs, playerKey, opts);
        if (result && typeof result === "object") {
          if (result.extraLog) newLog.push(String(result.extraLog));
          // eslint-disable-next-line no-unused-vars
          const { extraLog: _ignored, ...rest } = result;
          mechGs = rest;
        }
      } catch (err) {
        newLog.push(`Mechanic "${id}" failed: ${err.message}`);
      }
    }
    ps = mechGs[playerKey];
    opp = mechGs[oppKey];
    // Refresh defender reference in case mechanic touched it
    newDefender = opp.activePokemon || newDefender;
  }

  // Prompt-driven self-damage (e.g. RPS lose case where the attacker
  // bonks itself for 20). Applied to whichever attacker reference is
  // current — it may have been mutated by the resolver.
  if (promptEffect && Number(promptEffect.self_damage) > 0 && ps.activePokemon) {
    const sd = Number(promptEffect.self_damage);
    ps.activePokemon = { ...ps.activePokemon, damage: (ps.activePokemon.damage || 0) + sd };
    newLog.push(`${ps.activePokemon.def.name} took ${sd} damage to itself.`);
  }

  // Check KO
  if (newDefender && isKnockedOut(newDefender)) {
    newLog.push(`${newDefender.def.name} was Knocked Out!`);
    opp.discard = [...opp.discard, newDefender, ...newDefender.energyAttached];
    if (newDefender.toolAttached) opp.discard.push(newDefender.toolAttached);
    opp.activePokemon = null;

    // Prize card — attacker draws from THEIR OWN prize pile.
    const prizesTaken = getPrizesForKO(newDefender);
    const myPrizes = ps.prizeCards.slice(0, prizesTaken);
    newLog.push(`${ps.name} took ${prizesTaken} Prize card(s)!`);
    ps.hand = [...ps.hand, ...myPrizes];
    ps.prizeCards = ps.prizeCards.slice(prizesTaken);

    if (opp.bench.length > 0) {
      newLog.push(`${opp.name} must send up a new Active Pokémon.`);
    }
  }

  // Self-KO from prompt-driven self-damage (or from any earlier mutation
  // pushing damage past HP). The opponent collects prizes for the KO.
  if (ps.activePokemon && isKnockedOut(ps.activePokemon)) {
    const koed = ps.activePokemon;
    newLog.push(`${koed.def.name} was Knocked Out!`);
    ps.discard = [...ps.discard, koed, ...(koed.energyAttached || [])];
    if (koed.toolAttached) ps.discard.push(koed.toolAttached);
    ps.activePokemon = null;
    const prizesTaken = getPrizesForKO(koed);
    const oppPrizes = opp.prizeCards.slice(0, prizesTaken);
    opp.hand = [...opp.hand, ...oppPrizes];
    opp.prizeCards = opp.prizeCards.slice(prizesTaken);
    newLog.push(`${opp.name} took ${prizesTaken} Prize card(s)!`);
  }

  if (ps.activePokemon) {
    ps.activePokemon = { ...ps.activePokemon, attackedThisTurn: true };
  }

  newGs = autoPromoteAll({ ...newGs, [playerKey]: ps, [oppKey]: opp, log: newLog });

  // Check win
  const winResult = checkWinConditions(newGs);
  if (winResult) {
    return { ...newGs, winner: winResult.winner, phase: "finished", log: [...newGs.log, `${winResult.winner} wins! ${winResult.reason}`] };
  }

  return endTurn(newGs);
}

function getPrizesForKO(card) {
  const subtypes = card.def.subtypes || [];
  if (subtypes.some(s => ["EX","GX","VMAX","VSTAR"].includes(s))) return 2;
  if (subtypes.includes("ex")) return 2;
  return 1;
}

// ── Resolve attack text effects (skeleton per archetype) ──
// `gs` is optional and only used for turn-scoped flags (Agility, lock, etc).
function resolveAttackText(attack, attacker, defender, damage, ps, opp, log, gs) {
  const text = (attack.text || "").toLowerCase();
  const extraLog = [];
  const currentTurn = gs?.turn || 0;

  // ── Flip-until-tails damage scaling ─────────────────────────
  // "Flip a coin until you get tails. This attack does N damage times the
  // number of heads." (e.g. Jolteon's Thunder Jolt, many Electric attacks)
  if (text.includes("flip a coin until you get tails") || text.includes("flip coins until you get tails")) {
    const perHeadsMatch = text.match(/(\d+)\s*damage\s*(?:times|for each|per)?\s*(?:the\s*)?(?:number of\s*)?heads?/);
    const perHeads = perHeadsMatch ? parseInt(perHeadsMatch[1], 10) : 20;
    let heads = 0;
    // Safety cap to avoid pathological infinite loops in tests.
    for (let i = 0; i < 16; i++) {
      if (coinFlip() === "tails") break;
      heads++;
    }
    const bonus = heads * perHeads;
    damage += bonus;
    extraLog.push(`Flipped ${heads} heads before tails — +${bonus} damage.`);
  }

  // "This attack does N damage times the number of Energy attached..."
  else if (/damage\s*(?:times|for each|per)\s*(?:the\s*)?(?:number\s*of\s*)?energy/.test(text)) {
    const perMatch = text.match(/(\d+)\s*damage\s*(?:times|for each|per)/);
    const per = perMatch ? parseInt(perMatch[1], 10) : 10;
    const source = text.includes("defending") ? defender : attacker;
    const bonus = (source.energyAttached?.length || 0) * per;
    damage += bonus;
    extraLog.push(`+${bonus} from energy count (${source.def.name}).`);
  }

  // "...does N more damage for each damage counter on the Defending Pokémon."
  else if (/damage counters? on (?:the )?defending/.test(text) || /defending.*damage counters?/.test(text)) {
    const perMatch = text.match(/(\d+)\s*(?:more\s*)?damage(?:\s*for each|\s*times|\s*per)/);
    const per = perMatch ? parseInt(perMatch[1], 10) : 10;
    const counters = Math.floor((defender.damage || 0) / 10);
    const bonus = counters * per;
    damage += bonus;
    extraLog.push(`+${bonus} from opponent damage counters (${counters}×${per}).`);
  }

  // "If the Defending Pokémon has any damage counters on it, this attack does N more damage."
  else if (/if (?:the )?defending.*damage counters?.*(?:this attack )?does/.test(text)) {
    const moreMatch = text.match(/does\s*(\d+)\s*more/);
    const more = moreMatch ? parseInt(moreMatch[1], 10) : 20;
    if ((defender.damage || 0) > 0) {
      damage += more;
      extraLog.push(`+${more} because defender is damaged.`);
    }
  }

  // Agility-style: "During your opponent's next turn, prevent all effects of
  // attacks, including damage, done to [this Pokémon]."
  if (/prevent all effects of attacks.*done to/.test(text) || /prevent all damage done to/.test(text)) {
    // Many Agility-style attacks require a heads on a coin flip — if the text
    // mentions "flip a coin" we already resolved it above; honor the most
    // recent flip.
    const needsHeads = text.includes("flip a coin");
    const flipOk = needsHeads ? (extraLog.join(" ").includes("heads") || coinFlip() === "heads") : true;
    if (flipOk && ps.activePokemon) {
      ps.activePokemon = {
        ...ps.activePokemon,
        preventEffectsUntilTurn: currentTurn + 1,
      };
      extraLog.push(`${attacker.def.name} is protected until its next turn.`);
    } else if (needsHeads) {
      extraLog.push(`${attacker.def.name}'s protection failed.`);
    }
  }

  // Lock-style: "The Defending Pokémon can't attack during your opponent's next turn."
  if (/defending pok(?:é|e)mon can'?t attack/.test(text)) {
    if (opp.activePokemon) {
      opp.activePokemon = {
        ...opp.activePokemon,
        cantAttackUntilTurn: currentTurn + 1,
      };
      extraLog.push(`${defender.def.name} can't attack next turn.`);
    }
  }

  // Bench damage — spread or single
  // "...does N damage to each of your opponent's Benched Pokémon."
  const benchEachMatch = text.match(/(\d+)\s*damage\s*to\s*each\s*of\s*your\s*opponent'?s\s*benched/);
  if (benchEachMatch) {
    const n = parseInt(benchEachMatch[1], 10);
    opp.bench = opp.bench.map(b => ({ ...b, damage: (b.damage || 0) + n }));
    extraLog.push(`Bench damage: ${n} to each of ${opp.name}'s benched Pokémon.`);
  }

  // Coin flip effects
  if (text.includes("flip a coin") || text.includes("flip 2 coins") || text.includes("flip 3 coins") || text.includes("flip 4 coins")) {
    const coinCount = text.includes("flip 4") ? 4 : text.includes("flip 3") ? 3 : text.includes("flip 2") ? 2 : 1;
    const flips = flipCoins(coinCount);
    extraLog.push(`Coin flip(s): ${flips.join(", ")}`);
    const heads = flips.filter(f => f === "heads").length;

    if (text.includes("paralyzed") && flips[0] === "heads") {
      opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.PARALYZED };
      extraLog.push(`${defender.def.name} is now Paralyzed!`);
    }
    if (text.includes("asleep") && flips[0] === "heads") {
      opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.ASLEEP };
      extraLog.push(`${defender.def.name} is now Asleep!`);
    }
    if (text.includes("poisoned") && flips[0] === "heads") {
      opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.POISONED };
      extraLog.push(`${defender.def.name} is now Poisoned!`);
    }
    if (text.includes("confused") && flips[0] === "heads") {
      opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.CONFUSED };
      extraLog.push(`${defender.def.name} is now Confused!`);
    }
    if (text.includes("for each heads") || text.includes("heads, this attack does")) {
      damage += heads * 10;
      extraLog.push(`+${heads * 10} bonus from coin flips.`);
    }
    // "If tails, Foo does N damage on itself." Pull the actual N from the text
    // so different cards (Pikachu = 10, Zapdos Thunder = 30, etc.) hurt for the
    // right amount. Falls back to 10 for backwards compat.
    if (flips[0] === "tails" && text.includes("damage on itself")) {
      const m = text.match(/(\d+)\s*damage\s*on\s*itself/i);
      const sd = m ? Number(m[1]) : 10;
      attacker.damage += sd;
      extraLog.push(`${attacker.def.name} did ${sd} damage to itself.`);
    }
  }

  // "Foo does N damage to itself" — flat self-damage outside a coin flip
  // (Chansey Double-edge, Zapdos Thunderbolt-style discard, etc.).
  // Skip prompt-driven attacks (RPS, Birthday, height-guess) — those carry
  // their own conditional self-damage in the prompt resolver, and the
  // generic regex would mis-fire on conditional phrasing like
  // "If you lose, Hitmontop does 20 damage to itself."
  if (!text.includes("flip a coin") && !attack.prompt) {
    const m = text.match(/(\d+)\s*damage\s*to\s*itself/i);
    if (m) {
      const sd = Number(m[1]);
      attacker.damage += sd;
      extraLog.push(`${attacker.def.name} did ${sd} damage to itself.`);
    }
  }

  // Status conditions without coin flip
  if (!text.includes("flip") && text.includes("paralyzed")) {
    opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.PARALYZED };
    extraLog.push(`${defender.def.name} is now Paralyzed!`);
  }
  if (!text.includes("flip") && text.includes("asleep")) {
    opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.ASLEEP };
    extraLog.push(`${defender.def.name} is now Asleep!`);
  }
  if (!text.includes("flip") && text.includes("poisoned") && !text.includes("badly")) {
    opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.POISONED };
    extraLog.push(`${defender.def.name} is now Poisoned!`);
  }
  if (text.includes("badly poisoned")) {
    opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.BADLY_POISONED, poisonCounters: 1 };
    extraLog.push(`${defender.def.name} is now Badly Poisoned!`);
  }
  if (!text.includes("flip") && text.includes("confused")) {
    opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.CONFUSED };
    extraLog.push(`${defender.def.name} is now Confused!`);
  }
  if (!text.includes("flip") && text.includes("burned")) {
    opp.activePokemon = { ...opp.activePokemon, specialCondition: SPECIAL_CONDITIONS.BURNED };
    extraLog.push(`${defender.def.name} is now Burned!`);
  }

  // Discard energy from attacker
  if (text.includes("discard all") && text.includes("energy") && text.includes("this pok")) {
    attacker.energyAttached = [];
    extraLog.push(`${attacker.def.name} discarded all energy.`);
  } else if (text.includes("discard") && /\d+\s*energy/.test(text) && text.includes("this pok")) {
    const m = text.match(/discard\s*(\d+)\s*(?:[a-z]+\s*)?energy/);
    const n = m ? parseInt(m[1], 10) : 1;
    attacker.energyAttached = attacker.energyAttached.slice(0, Math.max(0, attacker.energyAttached.length - n));
    extraLog.push(`${attacker.def.name} discarded ${n} energy.`);
  }

  // Discard energy from the Defending Pokémon
  if (/discard.*energy.*(?:defending|opponent'?s active)/.test(text) ||
      /flip a coin.*if heads.*discard.*energy.*defending/.test(text)) {
    let shouldDiscard = true;
    if (text.includes("flip a coin") && text.includes("if heads")) {
      shouldDiscard = extraLog.join(" ").toLowerCase().includes("heads");
    }
    if (shouldDiscard && opp.activePokemon?.energyAttached?.length) {
      const numMatch = text.match(/discard\s*(\d+)\s*energy/);
      const numToDiscard = numMatch ? parseInt(numMatch[1], 10) : 1;
      const kept = opp.activePokemon.energyAttached.slice(0, Math.max(0, opp.activePokemon.energyAttached.length - numToDiscard));
      const discarded = opp.activePokemon.energyAttached.slice(kept.length);
      opp.activePokemon = { ...opp.activePokemon, energyAttached: kept };
      opp.discard = [...opp.discard, ...discarded];
      extraLog.push(`Discarded ${discarded.length} energy from ${defender.def.name}.`);
    }
  }

  // "Switch [this Pokémon] with one of your Benched Pokémon."
  // Resolved without requiring a target picker — swap with the highest-HP
  // benched Pokémon, which is usually what the user wants in a skirmish.
  if (/switch (?:this pok(?:é|e)mon|the attacking pok(?:é|e)mon) with one of your benched/.test(text)) {
    if (ps.bench.length > 0 && ps.activePokemon) {
      const bestBenchIdx = ps.bench
        .map((c, i) => ({ i, remaining: (c.def?.hp || 0) - (c.damage || 0) }))
        .sort((a, b) => b.remaining - a.remaining)[0]?.i ?? 0;
      const swap = ps.bench[bestBenchIdx];
      const newBench = ps.bench.filter((_, i) => i !== bestBenchIdx);
      newBench.push({ ...ps.activePokemon, specialCondition: null });
      ps.bench = newBench;
      ps.activePokemon = { ...swap, specialCondition: null };
      extraLog.push(`${attacker.def.name} switched out for ${swap.def.name}.`);
    }
  }

  // "Your opponent reveals their hand" / "Look at your opponent's hand."
  if (/look at your opponent'?s hand|opponent reveals their hand/.test(text)) {
    extraLog.push(`${ps.name} looked at ${opp.name}'s hand (${opp.hand.length} cards).`);
  }

  // "Discard the top N cards of your opponent's deck."
  const millMatch = text.match(/discard\s*(?:the\s*top\s*)?(\d+)\s*cards?\s*(?:of|from)\s*your\s*opponent'?s\s*deck/);
  if (millMatch) {
    const n = parseInt(millMatch[1], 10);
    const moved = opp.deck.slice(0, n);
    opp.deck = opp.deck.slice(n);
    opp.discard = [...opp.discard, ...moved];
    extraLog.push(`Discarded top ${moved.length} of ${opp.name}'s deck.`);
  }

  // Draw cards (attacker's draw — self-targeted)
  if ((text.includes("draw") && text.includes("card")) && !text.includes("opponent")) {
    const drawMatch = text.match(/draw\s*(\d+)/);
    if (drawMatch) {
      const n = parseInt(drawMatch[1], 10);
      ps = drawCards(ps, n);
      extraLog.push(`${ps.name} drew ${n} card(s).`);
    }
  }

  // Heal self — accept multiple phrasings
  if ((text.includes("heal") && (text.includes("from this pok") || text.includes("from the attacking"))) ||
      /remove\s*\d+\s*damage\s*counters?\s*from\s*this/.test(text)) {
    const healMatch = text.match(/heal\s*(\d+)/) || text.match(/remove\s*(\d+)\s*damage/);
    if (healMatch) {
      const n = parseInt(healMatch[1], 10) * (text.includes("damage counters") ? 10 : 1);
      attacker.damage = Math.max(0, attacker.damage - n);
      extraLog.push(`${attacker.def.name} healed ${n} damage.`);
    }
  }

  // Heal each of your Pokémon — bench-wide heal (e.g. Blissey-style "heal
  // 20 damage from each of your Pokémon").
  const benchHealMatch = text.match(/heal\s*(\d+)\s*damage\s*from\s*each\s*of\s*your/);
  if (benchHealMatch) {
    const n = parseInt(benchHealMatch[1], 10);
    if (ps.activePokemon) ps.activePokemon = { ...ps.activePokemon, damage: Math.max(0, (ps.activePokemon.damage || 0) - n) };
    ps.bench = ps.bench.map((c) => ({ ...c, damage: Math.max(0, (c.damage || 0) - n) }));
    extraLog.push(`${ps.name}'s Pokémon each healed ${n} damage.`);
  }

  // ── Snipe: deal damage to a Benched (or any non-Active) opponent Pokémon ─
  // "Does N damage to 1 of your opponent's Pokémon" / "...to 1 of your
  // opponent's Benched Pokémon". We pick the most-loaded benched threat
  // (highest energy + remaining HP), which is what a sane player would do.
  const snipeMatch = text.match(/(\d+)\s*damage\s*to\s*1\s*of\s*your\s*opponent'?s(?:\s*benched)?\s*pok/);
  if (snipeMatch) {
    const sd = parseInt(snipeMatch[1], 10);
    const bench = opp.bench || [];
    if (bench.length) {
      const idx = bench
        .map((c, i) => ({ i, score: (c.energyAttached?.length || 0) * 10 + ((c.def?.hp || 0) - (c.damage || 0)) }))
        .sort((a, b) => b.score - a.score)[0]?.i ?? 0;
      const target = bench[idx];
      const updated = { ...target, damage: (target.damage || 0) + sd };
      opp.bench = bench.map((c, i) => (i === idx ? updated : c));
      extraLog.push(`${attacker.def.name} sniped ${target.def.name} for ${sd} damage.`);
    }
  }

  // ── Damage to all of opponent's Pokémon (active + bench) ─
  const allDamageMatch = text.match(/(\d+)\s*damage\s*to\s*each\s*of\s*your\s*opponent'?s\s*pok/);
  if (allDamageMatch && !benchEachMatch) {
    const n = parseInt(allDamageMatch[1], 10);
    if (opp.activePokemon) opp.activePokemon = { ...opp.activePokemon, damage: (opp.activePokemon.damage || 0) + n };
    opp.bench = opp.bench.map((c) => ({ ...c, damage: (c.damage || 0) + n }));
    extraLog.push(`${n} damage to each of ${opp.name}'s Pokémon.`);
  }

  // ── Whirlwind / Gust of Wind / Catcher: force opponent to switch ─
  // "Switch the Defending Pokémon with one of your opponent's Benched"
  // is resolved by promoting whichever benched mon is most threatening to
  // us — i.e. lowest remaining HP, so we can KO it next turn.
  if (/switch (?:the )?defending pok(?:é|e)mon with one of your opponent'?s benched/.test(text)
      || /switch one of your opponent'?s benched.*with (?:the )?(?:defending|active)/.test(text)) {
    if (opp.bench.length > 0 && opp.activePokemon) {
      const targetIdx = opp.bench
        .map((c, i) => ({ i, score: -((c.def?.hp || 0) - (c.damage || 0)) }))
        .sort((a, b) => b.score - a.score)[0]?.i ?? 0;
      const newActive = opp.bench[targetIdx];
      opp.bench = [...opp.bench.filter((_, i) => i !== targetIdx), { ...opp.activePokemon, specialCondition: null }];
      opp.activePokemon = { ...newActive, specialCondition: null };
      extraLog.push(`${defender.def.name} was forced out — ${newActive.def.name} is now Active.`);
    }
  }

  // ── Search deck for a Basic Pokémon and put on bench ─
  // "Search your deck for a Basic Pokémon and put it onto your Bench."
  if (/search your deck for (?:a |up to \d+ )?basic pok(?:é|e)mon.*(?:bench|onto your bench)/.test(text)) {
    if (ps.bench.length < 5) {
      const basic = ps.deck.find((c) => c.def?.supertype === "Pokémon" && String(c.def?.stage || "").toLowerCase() === "basic");
      if (basic) {
        ps.deck = shuffle(ps.deck.filter((c) => c.instanceId !== basic.instanceId));
        ps.bench = [...ps.bench, basic];
        extraLog.push(`${ps.name} searched ${basic.def.name} onto the Bench.`);
      }
    }
  }

  // ── Attach an Energy from discard pile to the attacker ─
  // "Attach a [Type]/Basic Energy card from your discard pile to this Pokémon."
  if (/attach (?:a|an|\d+)\s*(?:basic\s*)?(?:[a-z]+\s*)?energy.*from your discard pile/.test(text)) {
    const energyInDiscard = ps.discard.find((c) => c.def?.supertype === "Energy");
    if (energyInDiscard) {
      ps.discard = ps.discard.filter((c) => c.instanceId !== energyInDiscard.instanceId);
      attacker.energyAttached = [...(attacker.energyAttached || []), energyInDiscard];
      extraLog.push(`Reattached ${energyInDiscard.def.name} from discard.`);
    }
  }

  // ── Put N damage counters on the Defending Pokémon ─
  // Counters are 10 damage each per the printed rules.
  const counterMatch = text.match(/put\s*(\d+)\s*damage\s*counters?\s*on\s*(?:the\s*)?defending/);
  if (counterMatch) {
    const counters = parseInt(counterMatch[1], 10);
    const dmg = counters * 10;
    if (opp.activePokemon) {
      opp.activePokemon = { ...opp.activePokemon, damage: (opp.activePokemon.damage || 0) + dmg };
      extraLog.push(`Placed ${counters} damage counter(s) on ${defender.def.name}.`);
    }
  }

  // ── Reduce damage from opponent's next attack ─
  // "During your opponent's next turn, any damage done to this Pokémon by
  //  attacks is reduced by N (after applying Weakness and Resistance)."
  const reduceMatch = text.match(/(?:any\s*)?damage\s*done\s*to\s*this\s*pok.*reduced\s*by\s*(\d+)/);
  if (reduceMatch && ps.activePokemon) {
    const n = parseInt(reduceMatch[1], 10);
    ps.activePokemon = { ...ps.activePokemon, damageReductionUntilTurn: currentTurn + 1, damageReductionAmount: n };
    extraLog.push(`${attacker.def.name} will take ${n} less damage from the next attack.`);
  }

  // ── Bonus damage if defender is a specific type ─
  // "If the Defending Pokémon is [Type], this attack does N more damage."
  const typeBonusMatch = text.match(/if\s*(?:the\s*)?defending\s*pok(?:é|e)mon\s*is\s*(?:a\s*)?(?:\[)?([a-z]+)(?:\])?[^.]*does\s*(\d+)\s*more/);
  if (typeBonusMatch) {
    const wantType = typeBonusMatch[1];
    const more = parseInt(typeBonusMatch[2], 10);
    const defType = String(defender.def?.energy_type || "").toLowerCase();
    if (defType === wantType || (wantType === "lightning" && defType === "electric")) {
      damage += more;
      extraLog.push(`+${more} bonus vs ${wantType}-type defender.`);
    }
  }

  return { damage, ps, opp, extraLog };
}

// ── Play Trainer Card ──────────────────────────────────────
export function playTrainer(gs, playerKey, cardInstanceId, targets = {}) {
  const ps = { ...gs[playerKey] };
  const card = ps.hand.find(c => c.instanceId === cardInstanceId);
  if (!card) return { ...gs, _error: "Card not in hand" };
  if (card.def.supertype !== "Trainer") return { ...gs, _error: "Not a trainer card" };
  if (card.def.isSupporter && ps.supporterPlayedThisTurn) return { ...gs, _error: "Already played a Supporter this turn" };

  let newGs = { ...gs };
  let newPs = { ...ps, hand: ps.hand.filter(c => c.instanceId !== cardInstanceId) };
  const newLog = [...gs.log, `${ps.name} played ${card.def.name}.`];

  // Resolve trainer effect
  const result = resolveTrainer(card, newPs, newGs, targets, newLog);
  newPs = result.ps;
  newGs = result.gs;

  if (card.def.isStadium) {
    newGs.stadium = card;
  } else {
    newPs.discard = [...newPs.discard, card];
  }

  if (card.def.isSupporter) newPs.supporterPlayedThisTurn = true;

  return { ...newGs, [playerKey]: newPs, log: result.log };
}

// Trainer effect resolver (covers most archetypes)
function resolveTrainer(card, ps, gs, targets, log) {
  const name = card.def.name.toLowerCase();
  const text = (card.def.rules?.[0] || "").toLowerCase();
  const extraLog = [...log];

  // Bill — draw 2 cards (classic Base Set trainer).
  if (/^bill\b/.test(name) || (name.includes("bill") && !name.includes("billy"))) {
    ps = drawCards(ps, 2);
    extraLog.push(`${ps.name} drew 2 cards.`);
  }

  // Computer Search — discard 2 to fetch any card from deck.
  else if (name.includes("computer search")) {
    const discarded = ps.hand.slice(0, 2);
    ps.discard = [...ps.discard, ...discarded];
    ps.hand = ps.hand.slice(2);
    if (targets.searchedCardId) {
      const found = ps.deck.find(c => c.def.id === targets.searchedCardId);
      if (found) {
        ps.deck = shuffle(ps.deck.filter(c => c.instanceId !== found.instanceId));
        ps.hand = [...ps.hand, found];
        extraLog.push(`${ps.name} fetched ${found.def.name} with Computer Search.`);
      }
    } else {
      extraLog.push(`${ps.name} discarded 2 for Computer Search.`);
    }
  }

  // Super Potion — heal 40 damage but discard 1 energy from the target.
  else if (name.includes("super potion")) {
    if (targets.targetInstanceId) {
      const applyTo = (poke) => {
        const discardedEnergy = poke.energyAttached.slice(-1);
        return {
          ...poke,
          damage: Math.max(0, (poke.damage || 0) - 40),
          energyAttached: poke.energyAttached.slice(0, -1),
          _discarded: discardedEnergy,
        };
      };
      let discardedEnergy = [];
      if (ps.activePokemon?.instanceId === targets.targetInstanceId && ps.activePokemon.energyAttached.length > 0) {
        const nxt = applyTo(ps.activePokemon);
        discardedEnergy = nxt._discarded; delete nxt._discarded;
        ps.activePokemon = nxt;
      } else {
        const idx = ps.bench.findIndex(c => c.instanceId === targets.targetInstanceId);
        if (idx !== -1 && ps.bench[idx].energyAttached.length > 0) {
          const nxt = applyTo(ps.bench[idx]);
          discardedEnergy = nxt._discarded; delete nxt._discarded;
          const nb = [...ps.bench]; nb[idx] = nxt; ps.bench = nb;
        }
      }
      ps.discard = [...ps.discard, ...discardedEnergy];
      extraLog.push(`${ps.name} healed 40 damage (Super Potion).`);
    }
  }

  // Full Heal — remove all special conditions from your Active Pokémon.
  else if (name.includes("full heal")) {
    if (ps.activePokemon) {
      ps.activePokemon = { ...ps.activePokemon, specialCondition: null, poisonCounters: 1 };
      extraLog.push(`${ps.name} used Full Heal on ${ps.activePokemon.def.name}.`);
    }
  }

  // Pokémon Center — heal all damage from your Pokémon but discard all energy on them.
  else if (name.includes("pokémon center") || name.includes("pokemon center")) {
    const clear = (poke) => ({
      ...poke,
      damage: 0,
      energyAttached: [],
    });
    const discardedEnergy = [
      ...(ps.activePokemon?.energyAttached || []),
      ...ps.bench.flatMap(b => b.energyAttached || []),
    ];
    if (ps.activePokemon) ps.activePokemon = clear(ps.activePokemon);
    ps.bench = ps.bench.map(clear);
    ps.discard = [...ps.discard, ...discardedEnergy];
    extraLog.push(`${ps.name} used Pokémon Center — all damage healed, ${discardedEnergy.length} energy discarded.`);
  }

  // Scoop Up — return Active Pokémon to hand (with evolution stripped).
  else if (name.includes("scoop up")) {
    if (ps.activePokemon) {
      const active = ps.activePokemon;
      const baseCard = { ...active, damage: 0, energyAttached: [], specialCondition: null, isEvolved: false };
      ps.discard = [...ps.discard, ...(active.energyAttached || [])];
      ps.hand = [...ps.hand, baseCard];
      ps.activePokemon = null;
      extraLog.push(`${ps.name} scooped up ${active.def.name}.`);
    }
  }

  // PlusPower — +10 damage to this turn's attack.
  else if (name.includes("pluspower")) {
    if (ps.activePokemon) {
      ps.activePokemon = {
        ...ps.activePokemon,
        damageBonusNextAttack: (ps.activePokemon.damageBonusNextAttack || 0) + 10,
      };
      extraLog.push(`${ps.activePokemon.def.name} gains +10 damage this turn.`);
    }
  }

  // Defender — prevents 20 damage done to the target next time it's attacked.
  else if (name.includes("defender")) {
    const attach = (poke) => ({
      ...poke,
      damageReduction: (poke.damageReduction || 0) + 20,
    });
    if (targets.targetInstanceId && ps.activePokemon?.instanceId === targets.targetInstanceId) {
      ps.activePokemon = attach(ps.activePokemon);
    } else if (targets.targetInstanceId) {
      const idx = ps.bench.findIndex(c => c.instanceId === targets.targetInstanceId);
      if (idx !== -1) {
        const nb = [...ps.bench]; nb[idx] = attach(nb[idx]); ps.bench = nb;
      }
    } else if (ps.activePokemon) {
      ps.activePokemon = attach(ps.activePokemon);
    }
    extraLog.push(`${ps.name} played Defender (-20 damage next hit).`);
  }

  // Item Finder — put a trainer card from discard back into your hand (costs 2 discards).
  else if (name.includes("item finder")) {
    const discarded = ps.hand.slice(0, 2);
    ps.discard = [...ps.discard, ...discarded];
    ps.hand = ps.hand.slice(2);
    const fetched = targets.searchedCardId
      ? ps.discard.find(c => c.def.id === targets.searchedCardId && c.def.supertype === "Trainer")
      : [...ps.discard].reverse().find(c => c.def.supertype === "Trainer");
    if (fetched) {
      ps.discard = ps.discard.filter(c => c.instanceId !== fetched.instanceId);
      ps.hand = [...ps.hand, fetched];
      extraLog.push(`${ps.name} recovered ${fetched.def.name} from discard.`);
    }
  }

  // Professor's Research / Professor's Letter / Hop etc. — draw 7
  else if (name.includes("professor") || (text.includes("discard your hand") && text.includes("draw 7"))) {
    ps.discard = [...ps.discard, ...ps.hand];
    ps.hand = [];
    ps = drawCards(ps, 7);
    extraLog.push(`${ps.name} discarded hand and drew 7.`);
  }

  // Iono / N — shuffle hand into deck, draw based on prize count
  else if (name.includes("iono") || name.includes(" n ")) {
    const prizes = ps.prizeCards.length;
    ps.deck = shuffle([...ps.deck, ...ps.hand]);
    ps.hand = [];
    ps = drawCards(ps, prizes);
    extraLog.push(`${ps.name} shuffled hand into deck and drew ${prizes}.`);
  }

  // Cynthia / Marnie — shuffle, draw 6
  else if (name.includes("cynthia") || name.includes("marnie") || text.includes("draw 6")) {
    ps.deck = shuffle([...ps.deck, ...ps.hand]);
    ps.hand = [];
    ps = drawCards(ps, 6);
    extraLog.push(`${ps.name} drew 6 cards.`);
  }

  // Ultra Ball / Great Ball / Nest Ball — search deck for Pokémon
  else if (name.includes("ball")) {
    if (name.includes("ultra ball")) {
      ps.discard = [...ps.discard, ...ps.hand.slice(0, 2)];
      ps.hand = ps.hand.slice(2);
      extraLog.push(`${ps.name} discarded 2 cards to search for a Pokémon.`);
    }
    // Basic search handled by UI: targets.searchedCardInstanceId
    if (targets.searchedCardId) {
      const found = ps.deck.find(c => c.def.id === targets.searchedCardId);
      if (found) {
        ps.deck = ps.deck.filter(c => c.instanceId !== found.instanceId);
        ps.deck = shuffle(ps.deck);
        ps.hand = [...ps.hand, found];
        extraLog.push(`${ps.name} searched deck and found ${found.def.name}.`);
      }
    }
  }

  // Switch — swap active with bench
  else if (name.includes("switch")) {
    if (targets.benchInstanceId && ps.activePokemon) {
      const benchPoke = ps.bench.find(c => c.instanceId === targets.benchInstanceId);
      if (benchPoke) {
        ps.bench = [...ps.bench.filter(c => c.instanceId !== targets.benchInstanceId), ps.activePokemon];
        ps.activePokemon = { ...benchPoke, specialCondition: null };
        extraLog.push(`${ps.name} switched ${ps.activePokemon.def.name} with ${benchPoke.def.name}.`);
      }
    }
  }

  // Rare Candy — evolve basic to stage 2
  else if (name.includes("rare candy")) {
    extraLog.push(`${ps.name} played Rare Candy — can evolve to Stage 2 this turn.`);
    ps.rareCandy = true;
  }

  // Energy retrieval
  else if (name.includes("energy retrieval") || name.includes("energy recycler")) {
    const energyInDiscard = ps.discard.filter(c => c.def.supertype === "Energy").slice(0, 2);
    ps.discard = ps.discard.filter(c => !energyInDiscard.includes(c));
    ps.hand = [...ps.hand, ...energyInDiscard];
    extraLog.push(`${ps.name} retrieved ${energyInDiscard.length} energy from discard.`);
  }

  // Boss's Orders / Gust of Wind — pull opponent's benched to active
  else if (name.includes("boss") || name.includes("gust of wind")) {
    const oppKey = gs.activePlayer === "player1" ? "player2" : "player1";
    const opp = { ...gs[oppKey] };
    if (targets.benchInstanceId && opp.bench.length > 0) {
      const benchPoke = opp.bench.find(c => c.instanceId === targets.benchInstanceId);
      if (benchPoke && opp.activePokemon) {
        opp.bench = [...opp.bench.filter(c => c.instanceId !== targets.benchInstanceId), opp.activePokemon];
        opp.activePokemon = benchPoke;
        gs = { ...gs, [oppKey]: opp };
        extraLog.push(`${ps.name} used Boss's Orders to bring out ${benchPoke.def.name}!`);
      }
    }
  }

  // Potion — heal 30
  else if (name.includes("potion") && !name.includes("max")) {
    if (targets.targetInstanceId) {
      const isActive = ps.activePokemon?.instanceId === targets.targetInstanceId;
      if (isActive) {
        ps.activePokemon = { ...ps.activePokemon, damage: Math.max(0, ps.activePokemon.damage - 30) };
      } else {
        const idx = ps.bench.findIndex(c => c.instanceId === targets.targetInstanceId);
        if (idx !== -1) {
          const newBench = [...ps.bench];
          newBench[idx] = { ...newBench[idx], damage: Math.max(0, newBench[idx].damage - 30) };
          ps.bench = newBench;
        }
      }
      extraLog.push(`${ps.name} healed 30 damage.`);
    }
  }

  // Max Potion — heal all damage but discard all energy
  else if (name.includes("max potion")) {
    if (targets.targetInstanceId) {
      const isActive = ps.activePokemon?.instanceId === targets.targetInstanceId;
      if (isActive) {
        ps.discard = [...ps.discard, ...ps.activePokemon.energyAttached];
        ps.activePokemon = { ...ps.activePokemon, damage: 0, energyAttached: [] };
      }
      extraLog.push(`${ps.name} used Max Potion to fully heal!`);
    }
  }

  // General draw
  else if (text.includes("draw ")) {
    const m = text.match(/draw (\d+)/);
    if (m) {
      ps = drawCards(ps, parseInt(m[1]));
      extraLog.push(`${ps.name} drew ${m[1]} card(s).`);
    }
  }

  return { ps, gs, log: extraLog };
}

// ── End Turn ───────────────────────────────────────────────
export function endTurn(gs) {
  const currentKey = gs.activePlayer;
  const nextKey = currentKey === "player1" ? "player2" : "player1";
  let newGs = { ...gs };

  // Reset turn flags for current player
  newGs[currentKey] = {
    ...newGs[currentKey],
    supporterPlayedThisTurn: false,
    energyAttachedThisTurn: false,
    retreatedThisTurn: false,
  };

  // Apply between-turn effects for the NEXT player's active (poison/burn/etc).
  const btResult = applyBetweenTurnEffects(newGs[nextKey], newGs.log);
  newGs[nextKey] = btResult.playerState;
  newGs.log = btResult.log;

  // Between-turn damage may have KO'd the next player's active. Handle KO +
  // prizes + auto-promote here before handing the turn over.
  const nextActive = newGs[nextKey].activePokemon;
  if (nextActive && isKnockedOut(nextActive)) {
    newGs.log = [...newGs.log, `${nextActive.def.name} was Knocked Out!`];
    const nextPs = { ...newGs[nextKey] };
    nextPs.discard = [...nextPs.discard, nextActive, ...(nextActive.energyAttached || [])];
    if (nextActive.toolAttached) nextPs.discard.push(nextActive.toolAttached);
    nextPs.activePokemon = null;
    const attackerPs = { ...newGs[currentKey] };
    const prizesTaken = getPrizesForKO(nextActive);
    const myPrizes = attackerPs.prizeCards.slice(0, prizesTaken);
    attackerPs.hand = [...attackerPs.hand, ...myPrizes];
    attackerPs.prizeCards = attackerPs.prizeCards.slice(prizesTaken);
    newGs.log = [...newGs.log, `${attackerPs.name} took ${prizesTaken} Prize card(s) (between-turn KO)!`];
    newGs = { ...newGs, [nextKey]: nextPs, [currentKey]: attackerPs };
  }

  newGs = autoPromoteAll(newGs);

  // Next player draws a card
  if (newGs[nextKey].deck.length > 0) {
    newGs[nextKey] = drawCards(newGs[nextKey], 1);
  } else if (newGs[nextKey].hand.length === 0) {
    // Deck out — current player wins
    return { ...newGs, winner: currentKey, phase: "finished", log: [...newGs.log, `${newGs[nextKey].name} decked out!`] };
  }

  // Reset attack flag on active Pokémon
  if (newGs[nextKey].activePokemon) {
    newGs[nextKey] = { ...newGs[nextKey], activePokemon: { ...newGs[nextKey].activePokemon, attackedThisTurn: false } };
  }

  const win = checkWinConditions(newGs);
  if (win) return { ...newGs, winner: win.winner, phase: "finished", log: [...newGs.log, `${win.winner} wins! ${win.reason}`] };

  return {
    ...newGs,
    activePlayer: nextKey,
    turn: newGs.turn + 1,
    phase: "main",
    log: [...newGs.log, `--- Turn ${newGs.turn + 1}: ${newGs[nextKey].name}'s turn ---`],
  };
}

// NOTE: The smarter `performAITurn` now lives in `./aiOpponent.js`. This file
// intentionally does not re-export an AI driver so imports resolve to the
// single source of truth.