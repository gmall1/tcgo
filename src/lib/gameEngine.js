// ============================================================
// POKÉMON TCG GAME ENGINE - Full Rules Implementation
// ============================================================
// Covers: prize cards, bench (5 slots), active Pokémon,
// energy attachment (1/turn), evolutions, trainer cards,
// special conditions (poisoned, burned, confused, paralyzed, asleep),
// coin flips, weakness/resistance, retreat cost, abilities,
// win conditions, and a skeleton for every trainer archetype.
// ============================================================

import { resolveCustomMechanic } from "./customMechanics";
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

  return {
    id: playerDef.id,
    name: playerDef.name,
    hand,
    deck: drawPile,
    discard: [],
    prizeCards,          // face-down prize pile (6 cards)
    activePokemon: null, // single playCard or null
    bench: [],           // up to 5 playCards
    stadium: null,       // active stadium card
    supporterPlayedThisTurn: false,
    energyAttachedThisTurn: false,
    mulligans,
  };
}

// ── Full game state ────────────────────────────────────────
export function createGameState(p1Def, p2Def, mode = "unlimited") {
  const firstPlayer = coinFlip() === "heads" ? "player1" : "player2";
  return {
    mode,
    turn: 1,
    phase: "setup",       // setup | p1_setup | p2_setup | main | attack | end | finished
    activePlayer: firstPlayer,
    player1: createPlayerState({ ...p1Def, id: "player1" }),
    player2: createPlayerState({ ...p2Def, id: "player2" }),
    winner: null,
    log: [`${firstPlayer === "player1" ? p1Def.name : p2Def.name} goes first!`],
    coinFlipResults: [],
    lastAction: null,
  };
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
export function calcDamage(attacker, defender, baseDamage) {
  let dmg = baseDamage;
  const defTypes = defender.def.types || [];

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

// ── Count energy of a type attached ───────────────────────
export function countEnergy(playCard, type = null) {
  if (!type) return playCard.energyAttached.length;
  // TODO: resolve special energy
  return playCard.energyAttached.filter(e => {
    if (!e) return false;
    const eName = e.def?.name?.toLowerCase() || "";
    if (type === "Colorless") return true;
    return eName.includes(type.toLowerCase());
  }).length;
}

// ── Check if an attack's energy cost is met ───────────────
export function canAffordAttack(attacker, attack) {
  const costMap = {};
  for (const c of attack.cost) {
    costMap[c] = (costMap[c] || 0) + 1;
  }
  const attachedTypes = attacker.energyAttached.map(e => {
    const n = e.def?.name?.toLowerCase() || "";
    if (n.includes("fire")) return "Fire";
    if (n.includes("water")) return "Water";
    if (n.includes("grass")) return "Grass";
    if (n.includes("lightning") || n.includes("electric")) return "Lightning";
    if (n.includes("psychic")) return "Psychic";
    if (n.includes("fighting")) return "Fighting";
    if (n.includes("darkness") || n.includes("dark")) return "Darkness";
    if (n.includes("metal") || n.includes("steel")) return "Metal";
    if (n.includes("dragon")) return "Dragon";
    if (n.includes("fairy")) return "Fairy";
    return "Colorless";
  });

  const available = { ...Object.fromEntries(ENERGY_TYPES.map(t => [t, 0])) };
  for (const t of attachedTypes) available[t] = (available[t] || 0) + 1;

  // Satisfy specific costs first
  const remaining = { ...costMap };
  for (const type of ENERGY_TYPES) {
    if (type === "Colorless") continue;
    const need = remaining[type] || 0;
    const have = available[type] || 0;
    const used = Math.min(need, have);
    remaining[type] = need - used;
    available[type] = have - used;
  }
  // Colorless can be any
  const colorlessNeed = remaining["Colorless"] || 0;
  const totalLeft = Object.values(available).reduce((a, b) => a + b, 0);
  return colorlessNeed <= totalLeft && Object.values(remaining).filter(v => v > 0 && v !== remaining["Colorless"]).length === 0;
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

// ── ATTACK ─────────────────────────────────────────────────
export function performAttack(gs, attackIndex) {
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

  const attack = attacker.def.attacks?.[attackIndex];
  if (!attack) return { ...gs, _error: "Attack not found" };
  if (!canAffordAttack(attacker, attack)) return { ...gs, _error: "Not enough energy" };

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
  let finalDmg = calcDamage(attacker, defender, baseDmg);

  newLog.push(`${attacker.def.name} used ${attack.name}${finalDmg > 0 ? ` for ${finalDmg} damage` : ""}!`);

  // Apply attack text effects (skeleton — expand per card)
  const effects = resolveAttackText(attack, attacker, defender, finalDmg, ps, opp, newLog);
  finalDmg = effects.damage;
  ps = effects.ps;
  opp = effects.opp;
  newLog.push(...effects.extraLog);

  // Apply damage
  let newDefender = { ...defender, damage: defender.damage + finalDmg };
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
function resolveAttackText(attack, attacker, defender, damage, ps, opp, log) {
  const text = (attack.text || "").toLowerCase();
  const extraLog = [];

  // Coin flip effects
  if (text.includes("flip a coin") || text.includes("flip 2 coins") || text.includes("flip 3 coins")) {
    const coinCount = text.includes("flip 3") ? 3 : text.includes("flip 2") ? 2 : 1;
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
    if (text.includes("damage on itself")) {
      attacker.damage += 10;
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

  // Heal self
  if (text.includes("heal") && text.includes("from this pokémon")) {
    const healMatch = text.match(/heal (\d+)/);
    if (healMatch) {
      attacker.damage = Math.max(0, attacker.damage - parseInt(healMatch[1]));
      extraLog.push(`${attacker.def.name} healed ${healMatch[1]} damage.`);
    }
  }

  // Discard energy from attacker
  if (text.includes("discard all") && text.includes("energy")) {
    attacker.energyAttached = [];
    extraLog.push(`${attacker.def.name} discarded all energy.`);
  }

  // Draw cards
  if (text.includes("draw") && text.includes("card")) {
    const drawMatch = text.match(/draw (\d+)/);
    if (drawMatch) {
      const n = parseInt(drawMatch[1]);
      ps = drawCards(ps, n);
      extraLog.push(`${ps.name} drew ${n} card(s).`);
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

  // Professor's Research / Professor's Letter / Hop etc. — draw 7
  if (name.includes("professor") || text.includes("discard your hand") && text.includes("draw 7")) {
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