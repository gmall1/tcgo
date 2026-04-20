# TCGO — Local TCG Live

A browser-based Pokémon-style trading card game with a full rules engine, local
AI opponent, and optional online multiplayer via a small FastAPI backend.

## Features

- Full rules engine (`src/lib/gameEngine.js`) — prize cards, bench, active
  Pokémon, energy attachment, evolutions, trainer cards, special conditions,
  coin flips, weakness/resistance, retreat, abilities, win conditions.
- Single-player vs. AI (`src/lib/aiOpponent.js`).
- Local deck building, card collection, and leaderboard backed by
  `localStorage` (`src/lib/localDb.js`).
- Optional network multiplayer (`backend/`) — a FastAPI service that lets two
  browsers on different machines play together over HTTP + WebSocket.
- Custom mechanic resolver (`src/lib/customMechanics.js`) wired into the engine
  so non-standard card effects can be registered and executed during attacks.

## Quick start

```bash
pnpm install
pnpm dev
```

Open the local URL Vite prints. Sessions, decks, and ranked results live in
`localStorage`.

## Testing & quality gates

```bash
pnpm lint        # eslint
pnpm test        # vitest (run once)
pnpm test:watch  # vitest --watch
pnpm build       # production build
```

## Online multiplayer

Network play is optional. Without a backend configured, rooms live in
`localStorage` and still work between tabs in the same browser.

### Run the backend

```bash
cd backend
uv sync                 # or: pip install -e .
uvicorn app:app --host 0.0.0.0 --port 8080 --reload
```

### Point the frontend at it

Either set `VITE_BACKEND_URL` before `pnpm dev`:

```bash
cp .env.example .env.local
# edit .env.local
pnpm dev
```

or paste the URL into the **Online** field inside the Lobby — the value is
remembered in `localStorage` via `setBackendUrl`.

Once configured, `createRoom` / `joinRoom` automatically prefer the backend,
and `Battle.jsx` subscribes to the room WebSocket so opponent moves arrive in
real time.

## Project layout

```
src/
├── App.jsx              routing
├── pages/               top-level screens (Battle, Lobby, Collection, ...)
├── lib/
│   ├── gameEngine.js    rules engine (pure, no I/O)
│   ├── aiOpponent.js    AI driver
│   ├── customMechanics.js  pluggable card-effect registry
│   ├── multiplayerSync.js  network / local room sync
│   ├── networkClient.js    HTTP + WebSocket client
│   └── localDb.js          localStorage-backed entity store
├── components/          shadcn UI + TCG-specific widgets
└── hooks/, utils/

backend/                 FastAPI service for network multiplayer (optional)
tests/                   Vitest suites for engine + sync
```
