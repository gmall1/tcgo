"""TCGO network-play backend.

Provides HTTP + WebSocket endpoints for multiplayer rooms so two browsers on
different machines can play. State lives in-memory (single-instance) and
auto-expires. For local/dev use; no durable database is required.
"""

from __future__ import annotations

import asyncio
import json
import random
import string
import time
from dataclasses import dataclass, field
from typing import Any

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


ROOM_TTL_SECONDS = 60 * 60 * 2  # 2h
WAITING_ROOM_TTL_SECONDS = 60 * 15  # 15 min
SWEEP_INTERVAL_SECONDS = 60


@dataclass
class Room:
    id: str
    code: str
    mode: str
    player1_id: str
    player1_name: str
    player1_deck: list[Any] = field(default_factory=list)
    player2_id: str | None = None
    player2_name: str | None = None
    player2_deck: list[Any] = field(default_factory=list)
    status: str = "waiting"  # waiting | ready | active | finished
    game_state: dict | None = None
    turn: int = 1
    active_player: str = "player1"
    winner_id: str | None = None
    last_action: dict | None = None
    last_action_timestamp: float = field(default_factory=time.time)
    created_at: float = field(default_factory=time.time)
    subscribers: set[WebSocket] = field(default_factory=set)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "mode": self.mode,
            "status": self.status,
            "player1_id": self.player1_id,
            "player1_name": self.player1_name,
            "player1_deck": self.player1_deck,
            "player2_id": self.player2_id,
            "player2_name": self.player2_name,
            "player2_deck": self.player2_deck,
            "game_state": self.game_state,
            "turn": self.turn,
            "active_player": self.active_player,
            "winner_id": self.winner_id,
            "last_action": self.last_action,
            "last_action_timestamp": self.last_action_timestamp,
            "created_date": self.created_at,
        }


rooms: dict[str, Room] = {}
code_to_id: dict[str, str] = {}
lock = asyncio.Lock()


class CreateRoomBody(BaseModel):
    mode: str = "unlimited"
    player_id: str
    player_name: str
    deck: list[Any] = Field(default_factory=list)


class JoinRoomBody(BaseModel):
    code: str
    player_id: str
    player_name: str
    deck: list[Any] = Field(default_factory=list)


class SyncGameStateBody(BaseModel):
    game_state: dict
    turn: int = 1
    active_player: str = "player1"
    winner_id: str | None = None
    status: str | None = None


class SyncActionBody(BaseModel):
    action: dict


def _rand_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choices(alphabet, k=6))


def _new_room_code() -> str:
    for _ in range(20):
        code = _rand_code()
        if code not in code_to_id:
            return code
    # fallback: ensure uniqueness even under collision storm
    return f"{_rand_code()}{int(time.time()) % 100}"


def _new_id() -> str:
    return f"room_{int(time.time() * 1000)}_{random.randint(1000, 9999)}"


async def _broadcast(room: Room) -> None:
    """Fan-out current room snapshot to all websocket subscribers."""
    data = json.dumps({"type": "room", "room": room.to_dict()})
    stale: list[WebSocket] = []
    for ws in list(room.subscribers):
        try:
            await ws.send_text(data)
        except Exception:
            stale.append(ws)
    for ws in stale:
        room.subscribers.discard(ws)


async def _sweep_loop() -> None:
    while True:
        await asyncio.sleep(SWEEP_INTERVAL_SECONDS)
        try:
            now = time.time()
            async with lock:
                to_remove = []
                for rid, room in rooms.items():
                    age = now - room.last_action_timestamp
                    if room.status == "waiting" and age > WAITING_ROOM_TTL_SECONDS:
                        to_remove.append(rid)
                    elif age > ROOM_TTL_SECONDS:
                        to_remove.append(rid)
                for rid in to_remove:
                    room = rooms.pop(rid, None)
                    if room:
                        code_to_id.pop(room.code, None)
        except Exception:
            # Sweeper must never die
            continue


app = FastAPI(title="TCGO Network Play", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def _startup() -> None:
    asyncio.create_task(_sweep_loop())


@app.get("/")
async def root() -> dict:
    return {
        "service": "tcgo-backend",
        "rooms_active": len(rooms),
        "version": "0.1.0",
    }


@app.get("/health")
async def health() -> dict:
    return {"ok": True, "ts": time.time()}


@app.get("/rooms")
async def list_rooms(status: str = "waiting", limit: int = 50) -> dict:
    async with lock:
        result = [
            r.to_dict()
            for r in rooms.values()
            if (not status or r.status == status)
        ]
    result.sort(key=lambda r: r["created_date"], reverse=True)
    return {"rooms": result[:limit]}


@app.post("/rooms")
async def create_room(body: CreateRoomBody) -> dict:
    async with lock:
        room_id = _new_id()
        code = _new_room_code()
        room = Room(
            id=room_id,
            code=code,
            mode=body.mode,
            player1_id=body.player_id,
            player1_name=body.player_name,
            player1_deck=body.deck,
        )
        rooms[room_id] = room
        code_to_id[code] = room_id
        return room.to_dict()


@app.post("/rooms/join")
async def join_room(body: JoinRoomBody) -> dict:
    code = body.code.upper().strip()
    async with lock:
        room_id = code_to_id.get(code)
        room = rooms.get(room_id) if room_id else None
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        if room.status != "waiting":
            raise HTTPException(status_code=409, detail=f"Room is {room.status}")
        if room.player1_id == body.player_id:
            # allow same user to join their own room as p2 (testing) with distinct id
            room.player2_id = f"{body.player_id}_p2"
        else:
            room.player2_id = body.player_id
        room.player2_name = body.player_name
        room.player2_deck = body.deck
        room.status = "ready"
        room.last_action_timestamp = time.time()
        snapshot = room
    await _broadcast(snapshot)
    return snapshot.to_dict()


@app.get("/rooms/{room_id}")
async def get_room(room_id: str) -> dict:
    async with lock:
        room = rooms.get(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        return room.to_dict()


@app.post("/rooms/{room_id}/state")
async def sync_state(room_id: str, body: SyncGameStateBody) -> dict:
    async with lock:
        room = rooms.get(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        room.game_state = body.game_state
        room.turn = body.turn
        room.active_player = body.active_player
        room.winner_id = body.winner_id
        if body.status:
            room.status = body.status
        elif body.winner_id:
            room.status = "finished"
        else:
            room.status = "active"
        room.last_action_timestamp = time.time()
        snapshot = room
    await _broadcast(snapshot)
    return snapshot.to_dict()


@app.post("/rooms/{room_id}/action")
async def sync_action(room_id: str, body: SyncActionBody) -> dict:
    async with lock:
        room = rooms.get(room_id)
        if not room:
            raise HTTPException(status_code=404, detail="Room not found")
        room.last_action = body.action
        room.last_action_timestamp = time.time()
        snapshot = room
    await _broadcast(snapshot)
    return snapshot.to_dict()


@app.websocket("/rooms/{room_id}/ws")
async def room_ws(ws: WebSocket, room_id: str) -> None:
    await ws.accept()
    async with lock:
        room = rooms.get(room_id)
    if not room:
        await ws.send_text(json.dumps({"type": "error", "error": "room_not_found"}))
        await ws.close()
        return
    room.subscribers.add(ws)
    try:
        # Immediately send current state
        await ws.send_text(json.dumps({"type": "room", "room": room.to_dict()}))
        while True:
            # Clients may push state over WS as a convenience
            msg = await ws.receive_text()
            try:
                payload = json.loads(msg)
            except Exception:
                continue

            kind = payload.get("type")
            if kind == "ping":
                await ws.send_text(json.dumps({"type": "pong", "ts": time.time()}))
                continue

            if kind == "state":
                gs = payload.get("game_state")
                async with lock:
                    if gs is not None:
                        room.game_state = gs
                    if "turn" in payload:
                        room.turn = int(payload["turn"])
                    if "active_player" in payload:
                        room.active_player = payload["active_player"]
                    if "winner_id" in payload:
                        room.winner_id = payload["winner_id"]
                    if "status" in payload:
                        room.status = payload["status"]
                    elif room.winner_id:
                        room.status = "finished"
                    else:
                        room.status = "active"
                    room.last_action_timestamp = time.time()
                await _broadcast(room)
            elif kind == "action":
                async with lock:
                    room.last_action = payload.get("action")
                    room.last_action_timestamp = time.time()
                await _broadcast(room)
    except WebSocketDisconnect:
        pass
    finally:
        room.subscribers.discard(ws)
