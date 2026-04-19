// ============================================================
// AI OPPONENT — Smart Pokémon TCG strategy
// ============================================================

import {
  attachEnergy,
  canAffordAttack,
  endTurn,
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
  if (score >= remainingHp) score += 50;
  if (score >= remainingHp * 0.5) score += 20;
  if (text.includes("paralyz")) score += 25;
  if (text.includes("asleep")) score += 15;
  if (text.includes("poison")) score += 20;
  if (text.includes("confus")) score += 12;
  if (text.includes("burned")) score += 18;
  const subtypes = defender?.def?.subtypes || [];
  if (subtypes.some(s => ["EX","GX","VMAX","VSTAR","ex"].includes(s))) score += 30;
  return score * personality.attackWeight;
}

function chooseBestPromotion(bench) {
  if (!bench.length) return null;
  return bench.reduce((best, c) => {
    const cScore = (c.def?.hp || 0) - c.damage + (c.energyAttached.length * 20);
    const bScore = (best.def?.hp || 0) - best.damage + (best.energyAttached.length * 20);
    return cScore > bScore ? c : best;
  });
}

function chooseEnergyTarget(ai) {
  const active = ai.activePokemon;
  if (active) {
    const attacks = active.def?.attacks || [];
    for (const atk of attacks) {
      const needed = atk.cost?.length || 0;
      const have = active.energyAttached.length;
      if (needed > 0 && have < needed) return active.instanceId;
    }
  }
  const benchWithEnergy = [...ai.bench].sort((a, b) => b.energyAttached.length - a.energyAttached.length);
  if (benchWithEnergy.length > 0) return benchWithEnergy[0].instanceId;
  return active?.instanceId || null;
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

  // 5. Attach energy
  const energyInHand = ai.hand.filter(c => c.def?.supertype === "Energy");
  if (energyInHand.length > 0 && !ai.energyAttachedThisTurn) {
    const targetId = chooseEnergyTarget(ai);
    if (targetId) {
      state = attachEnergy(state, aiKey, energyInHand[0].instanceId, targetId);
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
      return state;
    }
  }

  return endTurn(state);
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
