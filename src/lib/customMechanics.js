// ============================================================
// Custom Mechanics Resolver — handle non-standard card effects
// ============================================================

export const CUSTOM_MECHANICS = {};

// Register a custom mechanic
export function registerCustomMechanic(id, handler) {
  CUSTOM_MECHANICS[id] = handler;
}

// Check if a card has custom mechanics
export function getCardMechanics(card) {
  if (!card) return [];
  // In production, load from database
  // For now, return empty array
  return card.custom_mechanics || [];
}

// Resolve custom mechanic effect
export function resolveCustomMechanic(mechanicId, gameState, playerKey, options = {}) {
  const handler = CUSTOM_MECHANICS[mechanicId];
  if (!handler) {
    console.warn(`Unknown mechanic: ${mechanicId}`);
    return gameState;
  }
  return handler(gameState, playerKey, options);
}

// Example custom mechanics (add more as needed)

// Coin flip effect
export function registerDefaultMechanics() {
  registerCustomMechanic("coin-flip", (gs, pk, opts) => {
    const success = Math.random() > 0.5;
    return { ...gs, lastCoinFlip: success, extraLog: success ? "Heads!" : "Tails!" };
  });

  // Damage spread (damage multiple Pokémon)
  registerCustomMechanic("damage-spread", (gs, pk, opts) => {
    const { damage = 10, targets = ["opponent-active", "opponent-bench-0"] } = opts;
    let updated = JSON.parse(JSON.stringify(gs));
    
    targets.forEach(target => {
      if (target === "opponent-active") {
        const oppKey = pk === "player1" ? "player2" : "player1";
        if (updated[oppKey]?.activePokemon) {
          updated[oppKey].activePokemon.damage = (updated[oppKey].activePokemon.damage || 0) + damage;
        }
      }
      // Parse "opponent-bench-N" targets
      if (target.startsWith("opponent-bench-")) {
        const oppKey = pk === "player1" ? "player2" : "player1";
        const benchIdx = parseInt(target.split("-")[2]);
        if (updated[oppKey]?.bench?.[benchIdx]) {
          updated[oppKey].bench[benchIdx].damage = (updated[oppKey].bench[benchIdx].damage || 0) + damage;
        }
      }
    });

    return { ...updated, extraLog: `Spread ${damage} damage to ${targets.length} targets` };
  });

  // Energy acceleration (attach extra energy)
  registerCustomMechanic("energy-acceleration", (gs, pk, opts) => {
    const { amount = 1, energyType = "colorless" } = opts;
    let updated = JSON.parse(JSON.stringify(gs));
    
    if (updated[pk]?.activePokemon) {
      for (let i = 0; i < amount; i++) {
        if (!updated[pk].activePokemon.energyAttached) {
          updated[pk].activePokemon.energyAttached = [];
        }
        updated[pk].activePokemon.energyAttached.push({ 
          def: { name: `${energyType} Energy`, energy_type: energyType } 
        });
      }
    }

    return { ...updated, extraLog: `Attached ${amount} ${energyType} energy` };
  });

  // Draw cards
  registerCustomMechanic("draw-cards", (gs, pk, opts) => {
    const { amount = 1 } = opts;
    let updated = JSON.parse(JSON.stringify(gs));
    
    const toDraw = updated[pk]?.deck?.splice(0, amount) || [];
    if (!updated[pk].hand) updated[pk].hand = [];
    updated[pk].hand.push(...toDraw);

    return { ...updated, extraLog: `Drew ${toDraw.length} cards` };
  });

  // Search deck
  registerCustomMechanic("search-deck", (gs, pk, opts) => {
    const { cardName } = opts;
    let updated = JSON.parse(JSON.stringify(gs));
    
    const cardIdx = updated[pk]?.deck?.findIndex(c => c.def?.name?.includes(cardName));
    if (cardIdx >= 0) {
      const [card] = updated[pk].deck.splice(cardIdx, 1);
      if (!updated[pk].hand) updated[pk].hand = [];
      updated[pk].hand.push(card);
      return { ...updated, extraLog: `Searched deck for ${cardName}` };
    }

    return { ...updated, extraLog: `${cardName} not found in deck` };
  });

  // Heal
  registerCustomMechanic("heal", (gs, pk, opts) => {
    const { amount = 20 } = opts;
    let updated = JSON.parse(JSON.stringify(gs));
    
    if (updated[pk]?.activePokemon) {
      updated[pk].activePokemon.damage = Math.max(0, (updated[pk].activePokemon.damage || 0) - amount);
    }

    return { ...updated, extraLog: `Healed ${amount} damage` };
  });

  // Apply status condition
  registerCustomMechanic("apply-condition", (gs, pk, opts) => {
    const { condition = "poison", target = "opponent-active" } = opts;
    let updated = JSON.parse(JSON.stringify(gs));
    
    const targetKey = target.startsWith("opponent") ? (pk === "player1" ? "player2" : "player1") : pk;
    
    if (target === "opponent-active" || target === "active") {
      if (updated[targetKey]?.activePokemon) {
        updated[targetKey].activePokemon.specialCondition = condition;
      }
    }

    return { ...updated, extraLog: `Applied ${condition}` };
  });
}

// Initialize on load
registerDefaultMechanics();
