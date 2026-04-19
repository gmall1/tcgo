# Local TCG Live

This repository is a **local rebuild** of the exported app with the **Base44 runtime and build dependencies removed**.

## What changed

- Removed the Base44 Vite plugin and SDK dependencies.
- Replaced the hosted auth/entity layer with a **browser localStorage** data layer.
- Rebuilt the truncated pages that were preventing the app from compiling.
- Switched the app to a **local-only** workflow for decks, rooms, leaderboard, and battle state.

## What works now

- Local card collection browsing
- Local deck creation and editing
- Local room creation and joining
- AI battle mode
- Local ranked leaderboard with saved ELO in browser storage
- Production build with `pnpm build`

## Local development

```bash
pnpm install
pnpm dev
```

Open the local URL shown by Vite.

## Production build

```bash
pnpm build
```

The output is generated in `dist/`.

## Notes

This rebuild is intentionally lightweight. It avoids external app-platform dependencies and stores user, deck, room, and ranking data in the browser instead of a hosted backend.
