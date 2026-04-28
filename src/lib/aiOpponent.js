// ============================================================
// AI OPPONENT — Smart Pokémon TCG strategy
// ============================================================

import {
  attachEnergy,
  canAffordAttack,
  endTurn,
  evolvePokemon,
  getOpponentKey,
  performAttack,
  playBasicToBench,
  playTrainer,
  retreat,
  setActivePokemon,
} from "./gameEngine.js";

const PERSONALITIES = {
  aggressive: { attackWeight: 3, benchWeight: 0.5, energyWeight: 1, retreatThreshold: 0.15 },
  balanced:   { attackWeight: 1, benchWeight: 1.5, energyWeight: 2, retreatThreshold: 0.30 },
  stall:      { attackWeight: 0.5, benchWeight: 2, energyWeight: 1.5, retreatThreshold: 0.50 },
};

function detectPersonality(ai) {
  const allCards = [...ai.hand, ...(ai.activePokemon ? [ai.activePokemon] : []), ...ai.bench];
  const energyCount = allCards.filter(c => c.def?.supertype === "Energy").length;
  const trainerCount = allCards.filter(c => c.def?.supertype === "Trainer").length;
  if (trainerCount >= 4) return PERSONALITIES.stall;
  if (energyCount >= 6) return PERSONALITIES.aggressive;
  return PERSONALITIES.balanced;
}

function scoreAttack(attack, attacker, defender, personality) {
  let score = attack.damageValue || 0;
  const text = (attack.text || "").toLowerCase();
  const remainingHp = (defender?.def?.hp || 100) - (defender?.damage || 0);
  const attackerHp = attacker?.def?.hp || 100;
  const attackerRemaining = attackerHp - (attacker?.damage || 0);

  // Lethal is almost always correct.
  if (score >= remainingHp) score += 80;
  else if (score >= remainingHp * 0.6) score += 25;

  // Status-infliction is high-value pressure.
  if (text.includes("paralyz")) score += 28;
  if (text.includes("asleep")) score += 18;
  if (text.includes("poison")) score += 22;
  if (text.includes("confus")) score += 14;
  if (text.includes("burn")) score += 20;

  // Bench / spread damage — weight higher when opponent has a loaded bench
  // we can press, lower when they have nothing on the bench.
  if (/benched|bench|each of your opponent'?s/.test(text)) score += 12;

  // Coin-flip attacks are less reliable; damp their score slightly.
  if (/flip (a |the )?coin/i.test(text)) score -= 6;

  // Recoil / self-damage — avoid unless we're killing them or we're at full HP.
  const recoilMatch = text.match(/(\d+) damage to itself/i) || text.match(/takes? (\d+) damage/i);
  const recoil = recoilMatch ? Number(recoilMatch[1]) : 0;
  if (recoil > 0) {
    const wouldKO = score >= remainingHp;
    if (!wouldKO && recoil >= attackerRemaining) score -= 100;
    else if (!wouldKO) score -= Math.min(30, recoil * 0.7);
  }

  const subtypes = defender?.def?.subtypes || [];
  if (subtypes.some(s => ["EX","GX","VMAX","VSTAR","ex"].includes(s))) score += 35;

  // Always prefer to attack vs. letting a turn pass — ensure positive baseline.
  return Math.max(1, score) * personality.attackWeight;
}

function chooseBestPromotion(bench) {
  if (!bench.length) return null;
  return bench.reduce((best, c) => {
    const cScore = (c.def?.hp || 0) - c.damage + (c.energyAttached.length * 20);
    const bScore = (best.def?.hp || 0) - best.damage + (best.energyAttached.length * 20);
    return cScore > bScore ? c : best;
  });
}

// Given a list of energy cards in hand and the AI's mons, pick the
// energy / target pair that most efficiently powers a missing attack.
// Returns { energyId, targetId } or null. We prefer attaching typed energy
// onto a Pokémon whose next-attack cost still needs that exact type, then
// fall back to the Active.
function chooseEnergyAttach(ai) {
  const energies = ai.hand.filter((c) => c.def?.supertype === "Energy");
  if (!energies.length) return null;
  const candidates = [ai.activePokemon, ...ai.bench].filter(Boolean);

  function neededTypes(mon) {
    const counts = {};
    const attached = mon.energyAttached || [];
    for (const e of attached) {
      const n = (e.def?.name || "").toLowerCase();
      const t = n.includes("fire") ? "Fire"
        : n.includes("water") ? "Water"
        : n.includes("grass") ? "Grass"
        : n.includes("lightning") || n.includes("electric") ? "Lightning"
        : n.includes("psychic") ? "Psychic"
        : n.includes("fighting") ? "Fighting"
        : n.includes("dark") ? "Darkness"
        : n.includes("metal") || n.includes("steel") ? "Metal"
        : n.includes("dragon") ? "Dragon"
        : n.includes("fairy") ? "Fairy"
        : "Colorless";
      counts[t] = (counts[t] || 0) + 1;
    }
    const out = {};
    for (const atk of (mon.def?.attacks || [])) {
      for (const c of (atk.cost || [])) {
        if (c === "Colorless") continue;
        out[c] = Math.max(out[c] || 0, (atk.cost.filter((x) => x === c).length) - (counts[c] || 0));
      }
    }
    return out;
  }

  // Try to satisfy a typed cost first.
  for (const e of energies) {
    const en = (e.def?.name || "").toLowerCase();
    const provides = en.includes("fire") ? "Fire"
      : en.includes("water") ? "Water"
      : en.includes("grass") ? "Grass"
      : en.includes("lightning") || en.includes("electric") ? "Lightning"
      : en.includes("psychic") ? "Psychic"
      : en.includes("fighting") ? "Fighting"
      : en.includes("dark") ? "Darkness"
      : en.includes("metal") || en.includes("steel") ? "Metal"
      : en.includes("dragon") ? "Dragon"
      : en.includes("fairy") ? "Fairy"
      : null;
    if (!provides) continue;
    for (const m of candidates) {
      const need = neededTypes(m);
      if ((need[provides] || 0) > 0) {
        return { energyId: e.instanceId, targetId: m.instanceId };
      }
    }
  }

  // Otherwise dump the energy on whichever mon has an unmet attack cost,
  // preferring the Active so we can swing this turn.
  for (const m of candidates) {
    const attacks = m.def?.attacks || [];
    for (const atk of attacks) {
      if ((m.energyAttached?.length || 0) < (atk.cost?.length || 0)) {
        return { energyId: energies[0].instanceId, targetId: m.instanceId };
      }
    }
  }

  // Final fallback: attach to whoever has the most energy already (build
  // up a finisher on the bench).
  const target = [...ai.bench].sort((a, b) => (b.energyAttached?.length || 0) - (a.energyAttached?.length || 0))[0]
    || ai.activePokemon
    || null;
  if (!target) return null;
  return { energyId: energies[0].instanceId, targetId: target.instanceId };
}

function shouldRetreat(ai, personality) {
  const active = ai.activePokemon;
  if (!active || ai.retreatedThisTurn) return false;
  const hpPercent = ((active.def?.hp || 1) - active.damage) / (active.def?.hp || 1);
  if (hpPercent > personality.retreatThreshold) return false;
  return ai.bench.some(c => {
    const pct = ((c.def?.hp || 1) - c.damage) / (c.def?.hp || 1);
    return pct > 0.6;
  });
}

export function performAITurn(gs) {
  let state = { ...gs };
  const aiKey = state.activePlayer;
  let ai = state[aiKey];
  const personality = detectPersonality(ai);

  // 1. Play basics to bench
  const basics = ai.hand.filter(c => c.def?.supertype === "Pokémon" && c.def?.stage === "basic");
  for (const b of basics) {
    if (ai.bench.length < 5) {
      state = playBasicToBench(state, aiKey, b.instanceId);
      ai = state[aiKey];
    }
  }

  // 2. Promote if no active
  if (!ai.activePokemon && ai.bench.length > 0) {
    const best = chooseBestPromotion(ai.bench);
    if (best) {
      state = setActivePokemon(state, aiKey, best.instanceId);
      ai = state[aiKey];
    }
  }

  // 2.5. Evolve any pre-evolution we have an Active or Bench copy of.
  // We loop because evolving can unlock a Stage-2 we also have in hand
  // (e.g. Charmander → Charmeleon → Charizard via Rare Candy isn't supported,
  // but Stage 1 → Stage 2 the same turn is fine as long as the engine allows
  // it). evolvePokemon handles the "played this turn" guard for us.
  let evolvedAtLeastOne = true;
  while (evolvedAtLeastOne) {
    evolvedAtLeastOne = false;
    const evolutions = ai.hand.filter(
      (c) => c.def?.supertype === "Pokémon" && c.def?.evolvesFrom,
    );
    for (const evo of evolutions) {
      const targets = [
        ai.activePokemon,
        ...ai.bench,
      ].filter((t) => t && t.def?.name === evo.def.evolvesFrom);
      const target = targets.sort((a, b) => (b.energyAttached?.length || 0) - (a.energyAttached?.length || 0))[0];
      if (!target) continue;
      const next = evolvePokemon(state, aiKey, evo.instanceId, target.instanceId);
      if (next._error) continue;
      state = next;
      ai = state[aiKey];
      evolvedAtLeastOne = true;
      break;
    }
  }

  // 3. Play supporters
  if (!ai.supporterPlayedThisTurn) {
    const supporters = ai.hand.filter(c => c.def?.isSupporter);
    if (supporters.length > 0) {
      const drawSupporter = supporters.find(s => {
        const n = (s.def?.name || "").toLowerCase();
        return n.includes("professor") || n.includes("cynthia") || n.includes("iono") || n.includes("marnie");
      });
      const toPlay = ai.hand.length <= 3 ? (drawSupporter || supporters[0]) : supporters[0];
      state = playTrainer(state, aiKey, toPlay.instanceId, {});
      ai = state[aiKey];
    }
  }

  // 4. Play item trainers (prioritize healing when low HP)
  const items = ai.hand.filter(c => c.def?.supertype === "Trainer" && c.def?.isItem);
  for (const item of items) {
    const name = (item.def?.name || "").toLowerCase();
    const active = ai.activePokemon;
    if (active) {
      const hpPct = ((active.def?.hp || 1) - active.damage) / (active.def?.hp || 1);
      if (hpPct < 0.4 && (name.includes("potion") || name.includes("heal"))) {
        state = playTrainer(state, aiKey, item.instanceId, { targetInstanceId: active.instanceId });
        ai = state[aiKey];
        continue;
      }
    }
    if (name.includes("ball") || name.includes("switch") || name.includes("energy retrieval")) {
      state = playTrainer(state, aiKey, item.instanceId, {});
      ai = state[aiKey];
    }
  }

  // 5. Attach energy — prefer typed energies onto Pokémon that still need
  // that exact type. chooseEnergyAttach falls through to the Active so we
  // never skip an attach turn when there's an obvious slot.
  if (!ai.energyAttachedThisTurn) {
    const choice = chooseEnergyAttach(ai);
    if (choice) {
      state = attachEnergy(state, aiKey, choice.energyId, choice.targetId);
      ai = state[aiKey];
    }
  }

  // 6. Consider retreating
  if (shouldRetreat(ai, personality) && ai.bench.length > 0) {
    const newActive = chooseBestPromotion(ai.bench);
    if (newActive) {
      const retreatCost = ai.activePokemon?.def?.convertedRetreatCost || 0;
      const energyToDiscard = (ai.activePokemon?.energyAttached || [])
        .slice(0, retreatCost)
        .map(e => e.instanceId);
      if (energyToDiscard.length >= retreatCost) {
        state = retreat(state, aiKey, newActive.instanceId, energyToDiscard);
        ai = state[aiKey];
      }
    }
  }

  // 7. Attack
  if (ai.activePokemon && ai.activePokemon.def?.attacks?.length > 0) {
    const oppKey = getOpponentKey(state);
    const opp = state[oppKey];
    const attacks = ai.activePokemon.def.attacks;
    let bestIdx = -1;
    let bestScore = -1;
    attacks.forEach((atk, idx) => {
      if (canAffordAttack(ai.activePokemon, atk)) {
        const score = scoreAttack(atk, ai.activePokemon, opp.activePokemon, personality);
        if (score > bestScore) { bestScore = score; bestIdx = idx; }
      }
    });
    if (bestIdx >= 0) {
      state = performAttack(state, bestIdx);
      // Prompt-driven attacks (Birthday / Unown / RPS) short-circuit
      // performAttack and surface a `pendingAttack` instead of resolving.
      // For the AI, auto-answer the prompt and resume.
      if (state.pendingAttack) {
        const answer = autoAnswerPrompt(state.pendingAttack, state[oppKey]?.activePokemon);
        state = performAttack(state, state.pendingAttack.attackIndex, { promptAnswer: answer });
      }
      return state;
    }
  }

  return endTurn(state);
}

// Provide a sensible default answer for prompt-driven attacks when the
// AI is the attacker. Birthday: pretend it IS the AI's birthday so the
// attack hits. Height-guess: guess the defender's actual height ±0.2m.
// RPS: random throw, no peeking at the opponent's choice.
function autoAnswerPrompt(pending, defender) {
  const kind = pending?.prompt?.kind;
  if (kind === "birthday") return { isBirthday: true };
  if (kind === "height-guess") {
    const target = defender?.def?.height_m ?? pending.defenderHeight ?? 1.0;
    const jitter = (Math.random() - 0.5) * 0.4;
    return { guess: Math.max(0.1, Number(target) + jitter) };
  }
  if (kind === "rps") {
    const choices = ["rock", "paper", "scissors"];
    return { choice: choices[Math.floor(Math.random() * 3)] };
  }
  return {};
}

export function getAICommentary(isKO, hasStatus, cardName) {
  const koLines = [
    `${cardName} delivers the knockout blow!`,
    `Knocked Out! ${cardName} is relentless.`,
    `The AI claims another prize card!`,
    `${cardName} shows no mercy!`,
  ];
  const statusLines = [
    `${cardName} inflicts a special condition!`,
    `Status applied — the AI tightens its grip.`,
  ];
  const attackLines = [
    `${cardName} strikes with precision.`,
    `The AI has calculated the optimal move.`,
    `${cardName} presses the advantage!`,
    `Feel the power of ${cardName}!`,
  ];
  if (isKO) return koLines[Math.floor(Math.random() * koLines.length)];
  if (hasStatus) return statusLines[Math.floor(Math.random() * statusLines.length)];
  return attackLines[Math.floor(Math.random() * attackLines.length)];
}
