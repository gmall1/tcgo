// Regression tests for the three bugs flagged on PR #3 by Devin Review:
//   1. performAttack overwrote opp.activePokemon with a stale reference,
//      losing status conditions / cantAttackUntilTurn / energy discards.
//   2. normalizeEngineCard wrote weakness `value: "x2"` (ASCII x) while
//      calcDamage checks `startsWith("×")` (U+00D7), so starter-deck
//      weakness never multiplied damage.
//   3. resolveAttackText had two overlapping heal-self branches — attacks
//      with accented "Pokémon" text healed twice.
//
// Tests build fixtures directly (no createPlayerState) so they don't depend
// on Math.random from shuffling/mulligan logic.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  calcDamage,
  performAttack,
  SPECIAL_CONDITIONS,
} from "@/lib/gameEngine.js";

// ── Fixture helpers ──────────────────────────────────────────
function makeCardDef(overrides = {}) {
  return {
    id: "test-card",
    name: "Test Pokémon",
    supertype: "Pokémon",
    stage: "basic",
    hp: 100,
    types: ["Colorless"],
    weaknesses: [],
    resistances: [],
    convertedRetreatCost: 1,
    attacks: [],
    subtypes: [],
    ...overrides,
  };
}

function makePlayCard(def, overrides = {}) {
  return {
    instanceId: `pc-${def.id}-${Math.random().toString(36).slice(2, 8)}`,
    def,
    damage: 0,
    energyAttached: [],
    specialCondition: null,
    toolAttached: null,
    poisonCounters: 1,
    burnFlips: 0,
    isEvolved: false,
    evolvedFromInstanceId: null,
    turnPlayed: 0,
    attackedThisTurn: false,
    abilityUsedThisTurn: false,
    retreatedThisTurn: false,
    preventEffectsUntilTurn: 0,
    cantAttackUntilTurn: 0,
    damageBonusNextAttack: 0,
    ...overrides,
  };
}

function makeEnergy(type = "Colorless") {
  return makePlayCard(
    { id: `e-${type}`, name: `${type} Energy`, supertype: "Energy" },
    {}
  );
}

function makePlayerState(overrides = {}) {
  return {
    id: "player1",
    name: "P1",
    hand: [],
    deck: Array.from({ length: 20 }, (_, i) =>
      makePlayCard({ id: `d-${i}`, name: `Filler ${i}`, supertype: "Energy" })
    ),
    discard: [],
    prizeCards: Array.from({ length: 6 }, (_, i) =>
      makePlayCard({ id: `prize-${i}`, name: `Prize ${i}`, supertype: "Energy" })
    ),
    activePokemon: null,
    bench: [],
    stadium: null,
    supporterPlayedThisTurn: false,
    energyAttachedThisTurn: false,
    mulligans: 0,
    ...overrides,
  };
}

function makeGame({ p1, p2, overrides = {} } = {}) {
  return {
    mode: "unlimited",
    turn: 1,
    phase: "main",
    activePlayer: "player1",
    player1: p1,
    player2: p2,
    winner: null,
    log: [],
    coinFlipResults: [],
    lastAction: null,
    stateVersion: 0,
    ...overrides,
  };
}

// Deterministic coin flip for tests that go through flip branches.
function mockCoinHeads() {
  vi.spyOn(Math, "random").mockReturnValue(0); // < 0.5 → "heads"
}
function mockCoinTails() {
  vi.spyOn(Math, "random").mockReturnValue(0.9); // ≥ 0.5 → "tails"
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ──────────────────────────────────────────────────────────────
// BUG #2: weakness multiplier — Unicode × vs ASCII x
// ──────────────────────────────────────────────────────────────
describe("calcDamage — weakness multiplier (BUG #2)", () => {
  it("doubles damage when defender has Unicode '×2' weakness to attacker's type", () => {
    const attacker = makePlayCard(makeCardDef({ types: ["Water"] }));
    const defender = makePlayCard(
      makeCardDef({
        types: ["Fire"],
        weaknesses: [{ type: "Water", value: "\u00d72" }],
      })
    );
    expect(calcDamage(attacker, defender, 30)).toBe(60);
  });

  it("does NOT double damage when weakness uses ASCII 'x2' (prior bug)", () => {
    const attacker = makePlayCard(makeCardDef({ types: ["Water"] }));
    const defender = makePlayCard(
      makeCardDef({
        types: ["Fire"],
        weaknesses: [{ type: "Water", value: "x2" }],
      })
    );
    // Proves the pre-fix bug: ASCII x is ignored by calcDamage. If someone
    // regresses Battle.jsx back to ASCII, starter-deck weakness breaks and
    // this assertion forces a fix rather than silent failure.
    expect(calcDamage(attacker, defender, 30)).toBe(30);
  });

  it("ignores weakness when attacker type does not match", () => {
    const attacker = makePlayCard(makeCardDef({ types: ["Grass"] }));
    const defender = makePlayCard(
      makeCardDef({
        types: ["Fire"],
        weaknesses: [{ type: "Water", value: "\u00d72" }],
      })
    );
    expect(calcDamage(attacker, defender, 30)).toBe(30);
  });

  it("applies resistance subtraction", () => {
    const attacker = makePlayCard(makeCardDef({ types: ["Fire"] }));
    const defender = makePlayCard(
      makeCardDef({
        types: ["Water"],
        resistances: [{ type: "Fire", value: "-30" }],
      })
    );
    expect(calcDamage(attacker, defender, 50)).toBe(20);
  });
});

// ──────────────────────────────────────────────────────────────
// BUG #1: status conditions / locks applied during attack resolution
// must survive the damage-apply step.
// ──────────────────────────────────────────────────────────────
describe("performAttack — status effects applied during resolution stick (BUG #1)", () => {
  it("confuses defender when attack text says 'the Defending Pokémon is now Confused'", () => {
    // NB: using "confused" rather than "paralyzed" because applyBetweenTurnEffects
    // (called via endTurn at the end of performAttack) wakes/heals paralyzed +
    // asleep + burn conditions. Confusion persists between turns, so it's a
    // stable post-turn assertion.
    mockCoinHeads();
    const attackerDef = makeCardDef({
      id: "attacker",
      name: "Attacker",
      types: ["Psychic"],
      attacks: [
        {
          name: "Psybeam",
          damageValue: 10,
          cost: ["Colorless"],
          text: "Flip a coin. If heads, the Defending Pokémon is now Confused.",
        },
      ],
    });
    const defenderDef = makeCardDef({
      id: "defender",
      name: "Defender",
      hp: 100,
      types: ["Colorless"],
    });
    const attacker = makePlayCard(attackerDef, {
      energyAttached: [makeEnergy("Colorless")],
    });
    const defender = makePlayCard(defenderDef);
    const gs = makeGame({
      p1: makePlayerState({ id: "player1", name: "P1", activePokemon: attacker }),
      p2: makePlayerState({ id: "player2", name: "P2", activePokemon: defender }),
    });

    const next = performAttack(gs, 0);

    // After the fix: the confused condition set during resolveAttackText is
    // preserved on opp.activePokemon. Before the fix, `newDefender` was
    // rebuilt from the stale `defender` reference and specialCondition was
    // null after the damage step clobbered it.
    expect(next.player2.activePokemon.specialCondition).toBe(
      SPECIAL_CONDITIONS.CONFUSED
    );
    // Damage should still land on the defender.
    expect(next.player2.activePokemon.damage).toBe(10);
  });

  it("preserves cantAttackUntilTurn lock set by the attack resolver", () => {
    const attackerDef = makeCardDef({
      id: "lockattacker",
      name: "Lock Mon",
      types: ["Psychic"],
      attacks: [
        {
          name: "Mind Lock",
          damageValue: 10,
          cost: ["Colorless"],
          text: "The Defending Pokémon can't attack during your opponent's next turn.",
        },
      ],
    });
    const defenderDef = makeCardDef({ id: "lockdef", name: "Target", hp: 100 });
    const gs = makeGame({
      p1: makePlayerState({
        id: "player1",
        name: "P1",
        activePokemon: makePlayCard(attackerDef, {
          energyAttached: [makeEnergy("Colorless")],
        }),
      }),
      p2: makePlayerState({
        id: "player2",
        name: "P2",
        activePokemon: makePlayCard(defenderDef),
      }),
    });

    const next = performAttack(gs, 0);
    // Lock turn is set to currentTurn+1 (2 since we start on turn 1).
    expect(next.player2.activePokemon.cantAttackUntilTurn).toBeGreaterThanOrEqual(2);
  });

  it("preserves defender energy-discard performed by the attack resolver", () => {
    const attackerDef = makeCardDef({
      id: "discardAttacker",
      name: "Energy Thief",
      types: ["Darkness"],
      attacks: [
        {
          name: "Energy Drain",
          damageValue: 10,
          cost: ["Colorless"],
          text: "Discard 1 Energy from the Defending Pokémon.",
        },
      ],
    });
    const defenderDef = makeCardDef({ id: "tank", name: "Tank", hp: 120 });
    const defender = makePlayCard(defenderDef, {
      energyAttached: [makeEnergy("Water"), makeEnergy("Water")],
    });
    const gs = makeGame({
      p1: makePlayerState({
        id: "player1",
        name: "P1",
        activePokemon: makePlayCard(attackerDef, {
          energyAttached: [makeEnergy("Colorless")],
        }),
      }),
      p2: makePlayerState({ id: "player2", name: "P2", activePokemon: defender }),
    });

    const next = performAttack(gs, 0);

    // Before the fix: the stale-reference overwrite restored all original
    // energy on the defender. After: one energy was discarded.
    expect(next.player2.activePokemon.energyAttached.length).toBe(1);
    expect(next.player2.discard.length).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────
// BUG #3: two overlapping heal-self blocks. Both matched text containing
// accented "from this pokémon", healing twice. The first block has been
// removed; the remaining one handles all phrasings once.
// ──────────────────────────────────────────────────────────────
describe("performAttack — heal-self fires exactly once (BUG #3)", () => {
  it("heals the amount in the attack text, not 2×", () => {
    const attackerDef = makeCardDef({
      id: "healer",
      name: "Healer",
      hp: 100,
      types: ["Grass"],
      attacks: [
        {
          name: "Recover",
          damageValue: 0,
          cost: ["Colorless"],
          // Intentionally uses the accented é form that previously matched
          // both heal branches.
          text: "Heal 30 damage from this Pokémon.",
        },
      ],
    });
    const attacker = makePlayCard(attackerDef, {
      damage: 50,
      energyAttached: [makeEnergy("Colorless")],
    });
    const defender = makePlayCard(makeCardDef({ id: "punching-bag", hp: 100 }));
    const gs = makeGame({
      p1: makePlayerState({ id: "player1", name: "P1", activePokemon: attacker }),
      p2: makePlayerState({ id: "player2", name: "P2", activePokemon: defender }),
    });

    const next = performAttack(gs, 0);
    // Heal 30 once → damage goes 50 → 20 (NOT 50 → -10 clamped to 0).
    // The attacker is the player1 side; after performAttack calls endTurn(),
    // player1.activePokemon is still the attacker (same instanceId).
    expect(next.player1.activePokemon.damage).toBe(20);
  });
});

// ──────────────────────────────────────────────────────────────
// Agility-style protection: `preventEffectsUntilTurn >= gs.turn` on the
// defender must drop BOTH damage AND status riders. The fix for BUG #1
// initially switched the protected branch to read from the post-resolver
// `opp.activePokemon`, which let Confusion / locks / energy discards leak
// through protection. Regression test ensures the protected branch always
// falls back to the pre-resolver `defender` snapshot.
// ──────────────────────────────────────────────────────────────
describe("performAttack — Agility-style protection blocks status riders (BUG #4)", () => {
  it("does not apply Confusion when defender has preventEffectsUntilTurn >= turn", () => {
    mockCoinHeads();
    const attackerDef = makeCardDef({
      id: "protectedAttacker",
      name: "Psy Attacker",
      types: ["Psychic"],
      attacks: [
        {
          name: "Psybeam",
          damageValue: 40,
          cost: ["Colorless"],
          text: "Flip a coin. If heads, the Defending Pokémon is now Confused.",
        },
      ],
    });
    const defenderDef = makeCardDef({ id: "agile", name: "Agile Mon", hp: 100 });
    const defender = makePlayCard(defenderDef, {
      // Agility used last turn — effects prevented on this turn (gs.turn=1).
      preventEffectsUntilTurn: 1,
    });
    const gs = makeGame({
      p1: makePlayerState({
        id: "player1",
        name: "P1",
        activePokemon: makePlayCard(attackerDef, {
          energyAttached: [makeEnergy("Colorless")],
        }),
      }),
      p2: makePlayerState({ id: "player2", name: "P2", activePokemon: defender }),
    });

    const next = performAttack(gs, 0);

    // Damage blocked.
    expect(next.player2.activePokemon.damage).toBe(0);
    // Status rider ALSO blocked — this is the Agility invariant.
    expect(next.player2.activePokemon.specialCondition).toBe(null);
  });

  it("does not apply cantAttackUntilTurn lock when defender is protected", () => {
    const attackerDef = makeCardDef({
      id: "lockAtkProt",
      name: "Lock Caster",
      types: ["Psychic"],
      attacks: [
        {
          name: "Mind Lock",
          damageValue: 30,
          cost: ["Colorless"],
          text: "The Defending Pokémon can't attack during your opponent's next turn.",
        },
      ],
    });
    const defenderDef = makeCardDef({ id: "agile2", name: "Agile Mon 2", hp: 120 });
    const defender = makePlayCard(defenderDef, {
      preventEffectsUntilTurn: 1,
    });
    const gs = makeGame({
      p1: makePlayerState({
        id: "player1",
        name: "P1",
        activePokemon: makePlayCard(attackerDef, {
          energyAttached: [makeEnergy("Colorless")],
        }),
      }),
      p2: makePlayerState({ id: "player2", name: "P2", activePokemon: defender }),
    });

    const next = performAttack(gs, 0);

    expect(next.player2.activePokemon.damage).toBe(0);
    // Lock flag must NOT leak through protection.
    expect(next.player2.activePokemon.cantAttackUntilTurn || 0).toBe(0);
  });

  it("does not discard defender energy when defender is protected", () => {
    const attackerDef = makeCardDef({
      id: "drainProt",
      name: "Energy Thief",
      types: ["Darkness"],
      attacks: [
        {
          name: "Energy Drain",
          damageValue: 20,
          cost: ["Colorless"],
          text: "Discard 1 Energy from the Defending Pokémon.",
        },
      ],
    });
    const defenderDef = makeCardDef({ id: "agile3", name: "Agile Mon 3", hp: 120 });
    const defender = makePlayCard(defenderDef, {
      preventEffectsUntilTurn: 1,
      energyAttached: [makeEnergy("Water"), makeEnergy("Water")],
    });
    const gs = makeGame({
      p1: makePlayerState({
        id: "player1",
        name: "P1",
        activePokemon: makePlayCard(attackerDef, {
          energyAttached: [makeEnergy("Colorless")],
        }),
      }),
      p2: makePlayerState({ id: "player2", name: "P2", activePokemon: defender }),
    });

    const next = performAttack(gs, 0);

    expect(next.player2.activePokemon.damage).toBe(0);
    // Energy must NOT be discarded through protection.
    expect(next.player2.activePokemon.energyAttached.length).toBe(2);
    expect(next.player2.discard.length).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────
// BUG #5 (narrow-fix): Agility protection wraps ONLY the Defending
// Pokémon — per rulebook "prevent all effects of attacks done to this
// Pokémon." Effects that target the rest of the opponent's side (bench
// damage, mill, hand effects) must still land. The prior fix cloned and
// restored the entire `opp` which dropped those mutations too.
// ──────────────────────────────────────────────────────────────
describe("performAttack — Agility narrow-restore (BUG #5)", () => {
  it("applies bench damage even when active defender is protected", () => {
    const attackerDef = makeCardDef({
      id: "benchSniper",
      name: "Bench Sniper",
      types: ["Fighting"],
      attacks: [
        {
          name: "Earthquake",
          damageValue: 40,
          cost: ["Colorless"],
          text: "Does 10 damage to each of your opponent's Benched Pokémon.",
        },
      ],
    });
    const defenderDef = makeCardDef({ id: "agile4", name: "Agile Active", hp: 100 });
    const defender = makePlayCard(defenderDef, { preventEffectsUntilTurn: 1 });
    const benchMon = makePlayCard(makeCardDef({ id: "benched", name: "Bench Mon", hp: 80 }));
    const gs = makeGame({
      p1: makePlayerState({
        id: "player1",
        name: "P1",
        activePokemon: makePlayCard(attackerDef, {
          energyAttached: [makeEnergy("Colorless")],
        }),
      }),
      p2: makePlayerState({
        id: "player2",
        name: "P2",
        activePokemon: defender,
        bench: [benchMon],
      }),
    });

    const next = performAttack(gs, 0);

    // Active defender blocked.
    expect(next.player2.activePokemon.damage).toBe(0);
    // Bench Pokémon still took the bench-damage rider — it wasn't "done to
    // this Pokémon".
    expect(next.player2.bench[0].damage).toBeGreaterThanOrEqual(10);
  });

  it("does not duplicate protected defender energy in the opp discard pile", () => {
    // Regression for the narrow-restore implementation: when we restore
    // opp.activePokemon from the pre-resolver snapshot, any energy the
    // resolver moved into opp.discard must be filtered out so the same
    // energy card doesn't exist in both places.
    const attackerDef = makeCardDef({
      id: "drainProt2",
      name: "Energy Thief 2",
      types: ["Darkness"],
      attacks: [
        {
          name: "Energy Drain",
          damageValue: 20,
          cost: ["Colorless"],
          text: "Discard 1 Energy from the Defending Pokémon.",
        },
      ],
    });
    const defenderDef = makeCardDef({ id: "agile5", name: "Agile Mon 5", hp: 120 });
    const waterA = makeEnergy("Water");
    const waterB = makeEnergy("Water");
    const defender = makePlayCard(defenderDef, {
      preventEffectsUntilTurn: 1,
      energyAttached: [waterA, waterB],
    });
    const gs = makeGame({
      p1: makePlayerState({
        id: "player1",
        name: "P1",
        activePokemon: makePlayCard(attackerDef, {
          energyAttached: [makeEnergy("Colorless")],
        }),
      }),
      p2: makePlayerState({ id: "player2", name: "P2", activePokemon: defender }),
    });

    const next = performAttack(gs, 0);

    // Energy restored onto the defender.
    expect(next.player2.activePokemon.energyAttached.length).toBe(2);
    // And NOT also sitting in the discard pile (no duplication).
    const allIds = next.player2.activePokemon.energyAttached.map(e => e.instanceId);
    const dupInDiscard = next.player2.discard.filter(c => allIds.includes(c.instanceId));
    expect(dupInDiscard.length).toBe(0);
  });
});
