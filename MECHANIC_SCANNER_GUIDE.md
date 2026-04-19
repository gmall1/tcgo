# Mechanic Scanner — Auto-Generate Card Effects

## What it does

1. **Scans your card catalog** — reads attack descriptions
2. **Sends to Groq AI** — identifies unique mechanics
3. **Generates JavaScript code** — ready to use, no coding needed
4. **Downloads or auto-merges** — paste straight into the game

No manual tagging. No "which mechanic is this?" guessing. Just pure automation.

---

## How to use

### Step 1: Get Groq API key (free)
- Go to https://console.groq.com
- Sign up or log in
- Copy your API key
- It's free and resets monthly

### Step 2: Open Mechanic Scanner
1. Go to your game
2. Click **ADMIN** (bottom nav)
3. Click **Mechanic Scanner** (under Quick Tools)

### Step 3: Run scan
1. Paste your Groq API key
2. Set "cards per batch" (50 is good to start)
3. Click **Scan & Generate Code**
4. Watch the progress bar

### Step 4: Get the code
You now have three options:

**Option A: Download as file**
- Click **Download JS**
- Get `auto-mechanics.js`
- Open `src/lib/customMechanics.js`
- Find `registerDefaultMechanics()` function
- Paste the downloaded code inside it (before closing brace)

**Option B: Copy to clipboard**
- Click **Copy**
- Same as above, just paste manually

**Option C: Auto-merge (if available)**
- Click **Auto-merge**
- Game automatically incorporates the mechanics
- Restart the app

### Step 5: Restart and test
```bash
pnpm dev
```

All scanned mechanics are now live. Try a battle and see custom effects trigger.

---

## What it generates

The scanner creates code like this:

```javascript
// [Alakazam] Psychic Attack — High damage special attack
registerCustomMechanic("alakazam-psychic", (gs, pk, opts) => {
  let updated = JSON.parse(JSON.stringify(gs));
  // Damage is applied by game engine
  // This mechanic does: nothing extra (basic attack)
  return { ...updated, extraLog: "Alakazam used Psychic!" };
});

// [Electrode] Spread Attack — Damage spread to bench
registerCustomMechanic("electrode-spread", (gs, pk, opts) => {
  let updated = JSON.parse(JSON.stringify(gs));
  const oppKey = pk === "player1" ? "player2" : "player1";
  
  // Spread 20 to each benched Pokémon
  if (updated[oppKey]?.bench) {
    updated[oppKey].bench.forEach(p => {
      if (p) p.damage = (p.damage || 0) + 20;
    });
  }
  
  return { ...updated, extraLog: "Spread 20 damage to all benched Pokémon" };
});
```

---

## How Groq analyzes attacks

The scanner sends this prompt to Groq:

```
Analyze these Pokémon TCG card attacks and identify UNIQUE mechanics 
(not: basic damage, coin flip, draw, discard, heal, apply status).

[Lists 20 sample attacks]

For EACH unique mechanic found, generate JavaScript code that:
1. Takes the current game state
2. Modifies it based on the mechanic
3. Returns the updated state
```

Groq's job: **Identify what makes each attack special and turn it into code.**

---

## Examples of what it catches

### ✅ Caught mechanics:
- "Spread damage to bench" → generates damage-spread code
- "Draw cards from deck" → generates draw-cards code
- "Paralyze opponent" → generates apply-condition code
- "Search for any card" → generates search-deck code
- "Heal this Pokémon" → generates heal code
- "Remove opponent's energy" → generates energy-denial code

### ❌ Ignored (too basic):
- Basic damage (handled by engine already)
- Simple coin flip
- Basic draw/discard
- Standard conditions (PSN, BRN, SLP)

---

## Workflow

```
You: "Scan and generate"
    ↓
Scanner: Fetches 50 cards from catalog
    ↓
Scanner: Extracts attack descriptions
    ↓
Groq: Reads all descriptions
    ↓
Groq: "I see 12 unique mechanics here's the code"
    ↓
Scanner: Generates final JavaScript
    ↓
You: Download or auto-merge
    ↓
Game: Mechanics are live
```

---

## What to do with the code

### If using Download:
1. Save `auto-mechanics.js`
2. Open `src/lib/customMechanics.js`
3. Find this part:
```javascript
// Initialize on load
registerDefaultMechanics();
```
4. Add the new code RIGHT BEFORE that line
5. Restart with `pnpm dev`

### If using Copy:
Same as download, but you copy/paste manually instead of opening a file.

### If using Auto-merge:
The game does it for you. Just restart.

---

## Batch scanning

Want to scan 100 cards? 200 cards?

You can run multiple scans in a row:
1. First scan: 50 cards → generates mechanics
2. Second scan: Next 50 cards → generates more mechanics
3. Combine them manually or auto-merge each batch

Each run is independent — no conflicts.

---

## Cost

Groq is **free**.

- 10,000 requests/month free tier
- Each scan = 1 request
- You're fine scanning 100 times a month
- No credit card needed

---

## Troubleshooting

### "Groq API key invalid"
- Check you copied it exactly
- Make sure no extra spaces
- Try generating a new key on console.groq.com

### "No mechanics found"
- Your cards might not have complex attacks
- Try with a larger batch size (100+)
- Check that attacks have descriptions

### "Generated code is empty"
- Groq had an issue responding
- Try again, or check internet connection

### "I want to customize the mechanics"
- Generated code is just a starting point
- Edit it manually in `customMechanics.js`
- Restart and test

---

## Advanced: Custom scanning

Want to scan ONLY Pokémon? Only Trainers?

Modify the scanner code in `MechanicScanner.jsx`:
```javascript
const { cards } = await fetchCatalogCards({
  search: "type:pokemon",  // Change this
  filter: "pokemon",       // Or this
  page: 1,
  pageSize: cardsPerBatch,
});
```

But the UI doesn't expose this yet — would need to add a filter dropdown.

---

## Summary

**The old way:**
- Manually read each card
- Click checkboxes for mechanics
- Repeat 100 times
- 3 hours of work

**The new way:**
- Paste API key
- Click one button
- Get all mechanics as code
- 5 minutes of work

That's the power of automation. Use it.

