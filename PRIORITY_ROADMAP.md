# PRIORITY ROADMAP — Focus on What Matters

## STOP
- Monetization features (nice to have, not core)
- Card mechanic factory (cool but not critical)
- Sound admin (polish, not core)
- Pack/Battle pass (can add later)

## FOCUS — Next 4 hours

### 1. Fix Groq Mechanic Pipeline ❌ → ✅
**Problem**: `m.mechanics is not defined` in the widget
**Solution**: The widget had a bug in the Groq parsing logic
**Time**: 30 min
**Outcome**: Functional mechanic scanning tool

### 2. Get Multiplayer Working ❌ → ✅ (PRIORITY)
**Current state**: Battle.jsx can load multiplayer rooms, but opponent moves don't sync
**Problem**: When player2 makes a move, player1 doesn't see it immediately
**Solution**: Use subscribeToRoom to listen to opponent actions in real-time
**Time**: 1.5 hours
**Outcome**: Two players can play against each other live

### 3. AI Mechanics (BONUS)
**Problem**: resolveCustomMechanic isn't wired to gameEngine
**Solution**: Add custom mechanic resolver to gameEngine
**Time**: 1 hour
**Outcome**: Game can handle non-standard card effects

---

## Why this order?

1. **Multiplayer first** — People want to play together. That's the game.
2. **Mechanic system** — Needed for card interactions to work
3. **Everything else** — Can add after core is solid

---

## Current Blockers

### Multiplayer
- ✅ Room creation works (Lobby.jsx)
- ✅ Room persistence (localDb)
- ✅ Game state sync (syncGameState)
- ❌ Real-time opponent move sync (subscribeToRoom not fully wired)
- ❌ Handle "waiting for opponent" state

### Mechanics
- ❌ Groq widget has parsing bug
- ❌ Custom mechanics not integrated into gameEngine
- ❌ No way to chain effects (e.g., damage then apply condition)

---

## Next steps

1. Fix Groq widget bug
2. Add proper multiplayer sync to Battle.jsx
3. Integrate custom mechanics into performAttack/performAbility
4. Test 2-player game end-to-end

