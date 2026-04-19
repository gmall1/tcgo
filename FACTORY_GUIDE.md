# Game Development Factory Guide

## You Can Help Without Coding!

Even with no experience, you can improve the game when you hit Groq rate limits. Here are the two tools:

---

## 1. Card Mechanic Factory (`/admin` → Mechanic Factory)

**What it does:** Go through every card one at a time and tag what mechanics it uses.

**Why it matters:** The game needs to know which cards have which mechanics so the AI can play strategically and the engine can handle special effects correctly.

**How to use:**
1. Go to **ADMIN** panel
2. Click **Mechanic Factory**
3. Pick an expansion
4. For each card:
   - Read the attack/ability text
   - Click the mechanics it uses (e.g., "Coin Flip", "Damage Spread", "Draw Cards")
   - Add notes if it's confusing (optional)
   - Click **Next** to move to the next card

**Mechanic options:**
- Coin Flip — requires random outcome
- Damage Modifiers — changes damage amount
- Energy Acceleration — adds energy faster
- Draw Cards — gives player more cards
- Search Deck — finds specific cards
- Bench Swap — switches Pokémon
- Discard — removes cards from play
- Heal — restores HP
- Status Condition — applies poison/burn/sleep
- Energy Denial — removes opponent's energy
- Hand Disrupt — forces discard
- Damage Spread — damages multiple targets
- And 8 more...

**Progress is saved automatically** — you can stop anytime and pick up where you left off.

**Export when done** → Click **Export JSON** and send it to us so the mechanics list gets merged into the engine.

---

## 2. Sound Admin (`/admin` → Sound Settings)

**What it does:** Upload audio files for game sounds, set their volume, and toggle them on/off.

**Why it matters:** Sound design makes games *feel* real. A card flip sound is the difference between "clicking a button" and "playing a TCG".

**How to use:**
1. Go to **ADMIN** panel
2. Click **Sound Settings**
3. For each sound:
   - Toggle on/off with the circle button
   - Adjust volume with the slider (0-100)
   - Click **Play** to preview
   - Click **Add file** to paste a URL to an MP3 or WAV

**Where to find free sounds:**
- **Freesound.com** — Search "card flip", "game sfx", filter by Creative Commons
- **Zapsplat.com** — No signup needed, high quality
- **OpenGameArt.org** — Music and SFX made for games
- **Pixabay** — Music library, filter by mood

**To use a sound:**
1. Find a free sound on one of the sites above
2. Right-click the download button, copy the link
3. Click **Add file** on the sound you want
4. Paste the link
5. Click **Set**
6. Click **Play** to test

**Example:**
- Search Freesound for "card flip" → filter by CC0 (public domain) → download → copy link
- In Sound Admin, find "Card Flip" → click "Add file" → paste → Set → Play

---

## What Happens When You Submit

1. **Mechanic Factory**: Export JSON → send to devs → we analyze for patterns → update engine
2. **Sound Admin**: You toggle sounds on/off → saves to your browser → game plays them in real-time

The sounds don't require any coding. The game will play them automatically at the right moments:
- Card flip → when you draw a card
- Attack hit → when damage is dealt
- Victory chime → when you win

---

## Tips

**Mechanic Factory:**
- You don't need to know programming. Just read the card text and pick the most obvious mechanic.
- If a card has multiple mechanics, click them all. A card can have "Damage Modifiers" AND "Heal".
- Notes field is for things like "This card only works with Fire Pokémon" or "Very strong with energy acceleration".

**Sound Admin:**
- Start with battle sounds (card flip, attack, damage) before music.
- Lower volumes for UI sounds (menu clicks) — they should be subtle.
- Higher volumes for dramatic moments (victory, defeat).
- Test every sound before saving — make sure it's not too loud or distorted.

---

## Submit Your Work

When you're done:
1. **Mechanic Factory** → Click "Export JSON" → share the file
2. **Sound Admin** → No export needed, it's automatically saved to your browser

That's it. You're helping build a real game, and you don't need to know how to code.

