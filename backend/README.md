# tcgo-backend

Minimal FastAPI service powering optional **network multiplayer** for
[Local TCG Live](../). Rooms and game state are stored in-memory with
auto-expiry — no database required. Deploy it anywhere FastAPI runs
(Fly, Render, Railway, your own box).

## Local run

```bash
cd backend
uv sync          # or: pip install -e .
uvicorn app:app --host 0.0.0.0 --port 8080 --reload
```

Then set the frontend env var so it uses the backend:

```bash
# .env.local at the repo root
VITE_BACKEND_URL=http://localhost:8080
```

## HTTP API

| Method | Path                        | Purpose                          |
| ------ | --------------------------- | -------------------------------- |
| GET    | `/health`                   | Liveness probe                   |
| GET    | `/rooms?status=waiting`     | List open rooms                  |
| POST   | `/rooms`                    | Create room (returns room object)|
| POST   | `/rooms/join`               | Join a room by code              |
| GET    | `/rooms/{id}`               | Snapshot a single room           |
| POST   | `/rooms/{id}/state`         | Push game state                  |
| POST   | `/rooms/{id}/action`        | Push a last-action payload       |

## WebSocket

`ws://host/rooms/{id}/ws` — on connect the server emits the current room
snapshot. Clients can push `{"type":"state", ...}` or `{"type":"action", ...}`
messages; the server rebroadcasts to every subscriber.

## Notes

- State is ephemeral. Restart = empty lobby. This is intentional for a
  lightweight deployment; persistence can be added later if needed.
- Waiting rooms expire after 15 minutes; any room older than 2 hours is
  reaped. Tune via `WAITING_ROOM_TTL_SECONDS` / `ROOM_TTL_SECONDS`.
