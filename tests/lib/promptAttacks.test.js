// Tests for the prompt-driven attacks added in the engine pass:
//   - Birthday Pikachu (Birthday Surprise)
//   - Unown ANSWER (Guess the Height)
//   - Hitmontop / Throwdown (Rock-Paper-Scissors)
// These verify the engine surfaces a `pendingAttack` and resumes correctly.

import { describe, it, expect } from "vitest";
import {
  createGameState,
  performAttack,
  resolveAttackPrompt,
} from "@/lib/gameEngine";

// Tiny basic Pokémon factory — keeps tests focused on the prompt resolver.
function basic(id, name, attack, height_m = 1.0) {
  return {
    id,
    name,
    supertype: "Pokémon",
    stage: "basic",
    hp: 100,
    types: ["Colorless"],
    height_m,
    attacks: [attack],
    weaknesses: [],
    resistances: [],
    retreatCost: [],
  };
}

function deckOf(cardDef, n = 8) {
  return Array.from({ length: n }, () => cardDef);
}

function setup(attackerCard, defenderCard) {
  return createGameState(
    { id: "player1", name: "P1", deck: deckOf(attackerCard) },
    { id: "player2", name: "P2", deck: deckOf(defenderCard) },
    "unlimited",
    { firstPlayer: "player1" }
  );
}

describe("resolveAttackPrompt", () => {
  it("birthday yes → 30 dmg", () => {
    const out = resolveAttackPrompt(
      { kind: "birthday", on_yes: { damage: 30 }, on_no: { damage: 0 } },
      { isBirthday: true },
      null
    );
    expect(out.damage).toBe(30);
  });

  it("birthday no → 0 dmg", () => {
    const out = resolveAttackPrompt(
      { kind: "birthday", on_yes: { damage: 30 }, on_no: { damage: 0 } },
      { isBirthday: false },
      null
    );
    expect(out.damage).toBe(0);
  });

  it("height-guess inside 0.3m tier → 60 dmg", () => {
    const tiers = [
      { within: 0.3, damage: 60 },
      { within: 1.0, damage: 30 },
      { within: Infinity, damage: 0 },
    ];
    const defender = { def: { name: "Foo", height_m: 1.5 } };
    const out = resolveAttackPrompt(
      { kind: "height-guess", tiers },
      { guess: 1.4 },
      defender
    );
    expect(out.damage).toBe(60);
  });

  it("height-guess outside all tiers → 0 dmg", () => {
    const tiers = [{ within: 0.3, damage: 60 }, { within: 1.0, damage: 30 }];
    const defender = { def: { name: "Foo", height_m: 1.5 } };
    const out = resolveAttackPrompt(
      { kind: "height-guess", tiers },
      { guess: 5.0 },
      defender
    );
    expect(out.damage).toBe(0);
  });

  it("rps tie → tie damage", () => {
    const out = resolveAttackPrompt(
      {
        kind: "rps",
        win: { damage: 50 },
        tie: { damage: 20 },
        lose: { damage: 0, self_damage: 20 },
      },
      { choice: "rock", opponentChoice: "rock" },
      null
    );
    expect(out.damage).toBe(20);
  });

  it("rps win → win damage", () => {
    const out = resolveAttackPrompt(
      { kind: "rps", win: { damage: 50 }, tie: { damage: 20 }, lose: { damage: 0, self_damage: 20 } },
      { choice: "rock", opponentChoice: "scissors" },
      null
    );
    expect(out.damage).toBe(50);
  });

  it("rps lose → 0 damage but 20 self-damage", () => {
    const out = resolveAttackPrompt(
      { kind: "rps", win: { damage: 50 }, tie: { damage: 20 }, lose: { damage: 0, self_damage: 20 } },
      { choice: "rock", opponentChoice: "paper" },
      null
    );
    expect(out.damage).toBe(0);
    expect(out.self_damage).toBe(20);
  });
});

describe("performAttack — pending prompt suspension", () => {
  const birthdayAttack = {
    name: "Birthday Surprise",
    damageValue: 0,
    cost: [],
    text: "If today is your birthday, this attack does 30 damage.",
    prompt: { kind: "birthday", on_yes: { damage: 30 }, on_no: { damage: 0 } },
  };
  const dummy = {
    name: "Tackle",
    damageValue: 10,
    cost: [],
    text: "",
  };

  it("first call returns pendingAttack, no damage applied", () => {
    const attacker = basic("a", "Pikachu", birthdayAttack);
    const defender = basic("d", "Squirtle", dummy);
    const gs = setup(attacker, defender);
    const out = performAttack(gs, 0);
    expect(out.pendingAttack).toBeTruthy();
    expect(out.pendingAttack.prompt.kind).toBe("birthday");
    expect(out.player2.activePokemon.damage).toBe(0);
  });

  it("second call with promptAnswer applies the resolved damage", () => {
    const attacker = basic("a", "Pikachu", birthdayAttack);
    const defender = basic("d", "Squirtle", dummy);
    let gs = setup(attacker, defender);
    gs = performAttack(gs, 0);
    expect(gs.pendingAttack).toBeTruthy();
    const after = performAttack(gs, 0, { promptAnswer: { isBirthday: true } });
    // The active turn rotates after attack; defender still on field unless KO'd.
    // Find the player2 active pokemon damage taken.
    const dmgTaken =
      after.player2?.activePokemon?.damage ??
      // If KO'd it'd be in discard; for 30 dmg vs 100 hp it should NOT KO.
      0;
    expect(dmgTaken).toBe(30);
    expect(after.pendingAttack ?? null).toBeNull();
  });

  it("rps lose case applies self-damage to attacker", () => {
    const rpsAttack = {
      name: "Throwdown",
      damageValue: 0,
      cost: [],
      text: "RPS test attack.",
      prompt: {
        kind: "rps",
        win: { damage: 50 },
        tie: { damage: 20 },
        lose: { damage: 0, self_damage: 20 },
      },
    };
    const attacker = basic("a", "Hitmontop", rpsAttack);
    const defender = basic("d", "Squirtle", dummy);
    let gs = setup(attacker, defender);
    gs = performAttack(gs, 0);
    expect(gs.pendingAttack).toBeTruthy();
    const after = performAttack(gs, 0, {
      promptAnswer: { choice: "rock", opponentChoice: "paper" },
    });
    // Defender takes 0; attacker takes 20 self-damage. Active turn rotates,
    // so the attacker is now on the *non-active* side. The attacker's
    // activePokemon should still exist (100hp - 20 = 80 left).
    expect(after.player1.activePokemon.damage).toBe(20);
    expect(after.player2.activePokemon.damage).toBe(0);
  });
});
