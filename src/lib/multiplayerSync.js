import db, { ensurePlayerRank, getCurrentUserSync } from "@/lib/localDb";
import {
  createNetworkRoom,
  fetchNetworkRoom,
  isNetworkAvailable,
  joinNetworkRoom,
  listNetworkRooms,
  pushNetworkAction,
  pushNetworkState,
  subscribeNetworkRoom,
} from "@/lib/networkClient";

// ---- Mode detection --------------------------------------------------
// A "network" room lives on the backend; a "local" room lives only in the
// browser's localStorage. We remember which backend a room belongs to by
// the `id` prefix (`room_...`) and the presence of a runtime flag.

const NETWORK_ROOMS_KEY = "tcg_network_room_ids_v1";

function readNetworkRoomIds() {
  try {
    if (typeof window === "undefined") return new Set();
    const raw = window.localStorage.getItem(NETWORK_ROOMS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function rememberNetworkRoom(id) {
  if (!id) return;
  const ids = readNetworkRoomIds();
  ids.add(id);
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NETWORK_ROOMS_KEY, JSON.stringify([...ids]));
    }
  } catch {
    /* ignore */
  }
}

export function isNetworkRoom(roomId) {
  if (!roomId) return false;
  return readNetworkRoomIds().has(roomId);
}

// ---- Shared helpers --------------------------------------------------

export function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function resolveName(playerName, user) {
  return (playerName && playerName.trim()) || user?.full_name || "Local Player";
}

// ---- Create / Join --------------------------------------------------

/**
 * @param {string} playerName display name for this player
 * @param {string} mode unlimited | standard | ranked
 * @param {any[]} deck list of card IDs
 * @param {{ network?: boolean }} [options] force network or local room
 */
export async function createRoom(playerName, mode, deck = [], options = {}) {
  const user = await db.auth.me();
  ensurePlayerRank(user.id, user.full_name);
  const name = resolveName(playerName, user);
  const useNetwork = options.network ?? isNetworkAvailable();

  if (useNetwork && isNetworkAvailable()) {
    const room = await createNetworkRoom({
      mode,
      playerId: user.id,
      playerName: name,
      deck,
    });
    rememberNetworkRoom(room.id);
    return room;
  }

  return db.entities.GameRoom.create({
    code: generateRoomCode(),
    mode,
    status: "waiting",
    player1_id: user.id,
    player1_name: name,
    player1_deck: deck,
    player2_id: null,
    player2_name: null,
    player2_deck: [],
    game_state: null,
    turn: 1,
    active_player: "player1",
    winner_id: null,
    result_recorded: false,
    last_action: null,
    last_action_timestamp: new Date().toISOString(),
  });
}

export async function joinRoom(code, playerName, deck = [], options = {}) {
  const user = getCurrentUserSync();
  const name = resolveName(playerName, user);
  const upperCode = String(code || "").trim().toUpperCase();
  if (!upperCode) throw new Error("Enter a room code to join.");

  const preferNetwork = options.network ?? isNetworkAvailable();

  if (preferNetwork && isNetworkAvailable()) {
    try {
      const room = await joinNetworkRoom({
        code: upperCode,
        playerId: user.id,
        playerName: name,
        deck,
      });
      rememberNetworkRoom(room.id);
      return room;
    } catch (err) {
      // If network join fails and local room with the same code exists, fall
      // through to local join rather than stranding the user.
      const local = await findLocalWaitingRoomByCode(upperCode);
      if (!local) throw err;
    }
  }

  const local = await findLocalWaitingRoomByCode(upperCode);
  if (!local) throw new Error("Room not found or already started.");

  const player2Id = local.player1_id === user.id ? `${user.id}_p2` : user.id;
  return db.entities.GameRoom.update(local.id, {
    player2_id: player2Id,
    player2_name: name,
    player2_deck: deck,
    status: "ready",
    last_action_timestamp: new Date().toISOString(),
  });
}

async function findLocalWaitingRoomByCode(code) {
  const rooms = await db.entities.GameRoom.filter({ code, status: "waiting" });
  return rooms[0] || null;
}

// ---- Fetching rooms -------------------------------------------------

export async function fetchRoom(roomId) {
  if (isNetworkRoom(roomId)) {
    return fetchNetworkRoom(roomId);
  }
  return db.entities.GameRoom.get(roomId);
}

export async function listOpenRooms() {
  const local = await db.entities.GameRoom.filter({ status: "waiting" });
  const localRooms = local.map((room) => ({ ...room, _transport: "local" }));

  if (!isNetworkAvailable()) return localRooms;

  try {
    const net = await listNetworkRooms();
    const netRooms = net.map((room) => ({ ...room, _transport: "network" }));
    return [...netRooms, ...localRooms];
  } catch {
    return localRooms;
  }
}

// ---- Sync -----------------------------------------------------------

export async function syncGameState(roomId, gameState) {
  const payload = {
    gameState,
    turn: gameState.turn,
    activePlayer: gameState.activePlayer,
    winnerId: gameState.winner || null,
    status: gameState.phase === "finished" ? "finished" : "active",
  };

  if (isNetworkRoom(roomId)) {
    return pushNetworkState(roomId, payload);
  }

  return db.entities.GameRoom.update(roomId, {
    game_state: gameState,
    turn: gameState.turn,
    active_player: gameState.activePlayer,
    status: payload.status,
    winner_id: payload.winnerId,
    last_action_timestamp: new Date().toISOString(),
  });
}

export async function syncAction(roomId, action) {
  if (isNetworkRoom(roomId)) {
    return pushNetworkAction(roomId, action);
  }
  return db.entities.GameRoom.update(roomId, {
    last_action: action,
    last_action_timestamp: new Date().toISOString(),
  });
}

export function subscribeToRoom(roomId, onUpdate) {
  if (isNetworkRoom(roomId)) {
    return subscribeNetworkRoom(roomId, (room) => {
      if (room) onUpdate(room);
    });
  }

  return db.entities.GameRoom.subscribe((payload) => {
    if (!payload) return;
    if (payload.id === roomId || payload?.data?.id === roomId) {
      onUpdate(payload.data || payload);
    }
  });
}

// ---- ELO helpers (unchanged) ----------------------------------------

export function calcElo(winnerElo, loserElo, kFactor = 32) {
  const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  const expectedLoser = 1 - expectedWinner;
  return {
    newWinnerElo: Math.round(winnerElo + kFactor * (1 - expectedWinner)),
    newLoserElo: Math.round(loserElo + kFactor * (0 - expectedLoser)),
  };
}

export function eloToTier(elo) {
  if (elo < 1100) return "bronze";
  if (elo < 1300) return "silver";
  if (elo < 1500) return "gold";
  if (elo < 1700) return "platinum";
  if (elo < 2000) return "diamond";
  return "master";
}

export async function recordMatchResult(
  winnerId,
  loserId,
  mode,
  turns,
  durationSeconds,
  p1PrizeTaken = 0,
  p2PrizeTaken = 0,
  forfeit = false
) {
  await db.entities.Match.create({
    player1_id: winnerId,
    player2_id: loserId,
    winner_id: winnerId,
    loser_id: loserId,
    mode,
    turns,
    duration_seconds: durationSeconds,
    p1_prize_cards_taken: p1PrizeTaken,
    p2_prize_cards_taken: p2PrizeTaken,
    forfeit,
  });

  if (mode !== "ranked") return;

  const winnerRank = ensurePlayerRank(
    winnerId,
    winnerId === getCurrentUserSync().id ? getCurrentUserSync().full_name : "Local Rival"
  );
  const loserRank = ensurePlayerRank(
    loserId,
    loserId === getCurrentUserSync().id ? getCurrentUserSync().full_name : "Local Rival"
  );

  const { newWinnerElo, newLoserElo } = calcElo(winnerRank.elo, loserRank.elo);

  await Promise.all([
    db.entities.PlayerRank.update(winnerRank.id, {
      elo: newWinnerElo,
      rank_tier: eloToTier(newWinnerElo),
      wins: (winnerRank.wins || 0) + 1,
      win_streak: (winnerRank.win_streak || 0) + 1,
    }),
    db.entities.PlayerRank.update(loserRank.id, {
      elo: newLoserElo,
      rank_tier: eloToTier(newLoserElo),
      losses: (loserRank.losses || 0) + 1,
      win_streak: 0,
    }),
  ]);
}
