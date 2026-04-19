# Development Workflow — Never Reinstall

## The Problem You're Hitting

Every time we pack a new zip, you're extracting it fresh and running `pnpm install` again. That's **5-10 minutes of wasted time** per iteration.

## The Solution: Keep One Instance Running

### Setup (ONE TIME)

```bash
cd local-tcg-studio
pnpm install
pnpm dev
```

Then **leave it running**. Never close it.

---

## Workflow (From Now On)

### You get a code update:

1. **Download the zip** → Extract to a **different folder** (e.g., `local-tcg-studio-v2`)
2. **Copy ONLY the changed files** from new zip to your running instance
3. **Save the file** in your running code
4. **Watch browser refresh automatically** (Vite hot reload)
5. **Test immediately** — no restart needed

---

## Example: I just added Mechanic Studio

**OLD WAY (BAD):**
```bash
unzip local-tcg-studio.zip
cd local-tcg-studio
pnpm install
pnpm dev
# 10 minutes lost
```

**NEW WAY (GOOD):**
```bash
# Terminal 1 (leave running always):
cd local-tcg-studio
pnpm dev
# Running since yesterday. Still running.

# Terminal 2 (when you get update):
unzip local-tcg-studio.zip -d /tmp/new
cp /tmp/new/src/pages/MechanicStudio.jsx local-tcg-studio/src/pages/

# Browser auto-refreshes. Feature works. Done.
# 30 seconds total.
```

---

## How to Know What Files Changed

When I give you an update, I'll tell you which files changed:

**Example:**
```
✅ Updated: src/pages/MechanicStudio.jsx
✅ Updated: src/pages/Admin.jsx
✅ Updated: src/App.jsx
✅ Updated: src/lib/customMechanics.js
```

Then you only copy those files. Everything else stays.

---

## Hot Reload Works For:

- ✅ React components (`.jsx`)
- ✅ Styling changes (`.css`)
- ✅ Library code (`.js`)
- ✅ Config changes (`vite.config.js`)

Hot reload **restarts automatically**. You see changes in browser in **<1 second**.

---

## When You DO Need to Restart

Only if:
- You install a **new npm package** (`pnpm add something`)
- You modify `package.json`
- You change `.env` variables

```bash
# Only in these cases:
pnpm dev
# Stop with Ctrl+C and restart
```

---

## File Organization (Recommended)

```
~/projects/
├── local-tcg-studio/          ← MAIN: Always running
│   ├── src/
│   ├── package.json
│   └── pnpm-lock.yaml
│
├── local-tcg-studio-backup/   ← BACKUP: Previous version
│
└── Downloads/
    └── local-tcg-studio.zip   ← NEW: When you get updates
```

---

## Copy Files Safely

**Using command line (fastest):**
```bash
# Copy specific files from new zip to running instance
cp /tmp/extracted/src/pages/MechanicStudio.jsx ~/projects/local-tcg-studio/src/pages/

# Or copy entire directory
cp -r /tmp/extracted/src/lib/* ~/projects/local-tcg-studio/src/lib/
```

**Using file explorer:**
1. Extract new zip to Desktop
2. Navigate to `src/pages`
3. Copy files you need
4. Paste into your running project's `src/pages`
5. Switch to browser — already reloaded

---

## Checklist for Each Update

- [ ] I tell you which files changed
- [ ] You extract the new zip to a temp folder
- [ ] You copy only the changed files
- [ ] Your running dev server picks up changes
- [ ] Browser auto-refreshes
- [ ] Test the new feature
- [ ] Done (no restart, no reinstall)

---

## Git (Optional, But Recommended)

If you initialize git in your main instance, you can **see exactly what changed**:

```bash
cd local-tcg-studio
git init
git add .
git commit -m "Initial setup"

# When you get an update:
# Extract new version
# Diff against git history
# Cherry-pick changes you need
```

Then:
```bash
git diff local-tcg-studio-v2/src/pages/MechanicStudio.jsx
```

Shows **exactly what changed**. Copy only those parts.

---

## Performance

- **Cold start** (fresh install): 2-3 minutes
- **Hot reload** (update): <1 second
- **Monthly savings**: ~30 minutes per update
- **Over a year**: 6+ hours not wasted

---

## Your New Workflow

```
You: "Hey Claude, add feature X"

Claude: "Done. Changed files: src/pages/X.jsx, src/lib/Y.js"

You: 
  1. Extract new zip
  2. Copy those 2 files to running folder
  3. Watch browser auto-reload
  4. Test feature
  5. Done

Time: 1 minute total
```

---

## What NOT to Do

❌ Extract and reinstall every time
❌ Run `pnpm install` unless packages changed
❌ Close your dev server
❌ Copy entire `/node_modules` folder
❌ Restart dev server for file changes

---

## What TO Do

✅ Keep one instance running 24/7
✅ Copy only changed files
✅ Let Vite hot-reload
✅ Extract new zips to temp folder
✅ Diff before copying

---

## Summary

**You should never need to:**
- `cd` into a new folder
- Run `pnpm install`
- Close `pnpm dev`
- Wait for compilation

**Just:**
- Get update
- Copy files
- Done

Development should feel instant. It can be.

