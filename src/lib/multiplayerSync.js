import db, { ensurePlayerRank, getCurrentUserSync } from "@/lib/localDb";

export function generateRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export async function createRoom(playerName, mode, deck = []) {
  const user = await db.auth.me();
  ensurePlayerRank(user.id, user.full_name);

  return db.entities.GameRoom.create({
    code: generateRoomCode(),
    mode,
    status: "waiting",
    player1_id: user.id,
    player1_name: playerName || user.full_name,
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

export async function joinRoom(code, playerName, deck = []) {
  const user = getCurrentUserSync();
  const rooms = await db.entities.GameRoom.filter({ code, status: "waiting" });
  const room = rooms[0];

  if (!room) {
    throw new Error("Room not found or already started.");
  }

  const player2Id = room.player1_id === user.id ? `${user.id}_p2` : user.id;

  return db.entities.GameRoom.update(room.id, {
    player2_id: player2Id,
    player2_name: playerName || `${user.full_name} 2`,
    player2_deck: deck,
    status: "ready",
    last_action_timestamp: new Date().toISOString(),
  });
}

export async function syncGameState(roomId, gameState) {
  return db.entities.GameRoom.update(roomId, {
    game_state: gameState,
    turn: gameState.turn,
    active_player: gameState.activePlayer,
    status: gameState.phase === "finished" ? "finished" : "active",
    winner_id: gameState.winner || null,
    last_action_timestamp: new Date().toISOString(),
  });
}

export async function syncAction(roomId, action) {
  return db.entities.GameRoom.update(roomId, {
    last_action: action,
    last_action_timestamp: new Date().toISOString(),
  });
}

export function subscribeToRoom(roomId, onUpdate) {
  return db.entities.GameRoom.subscribe((payload) => {
    if (!payload) {
      return;
    }

    if (payload.id === roomId || payload?.data?.id === roomId) {
      onUpdate(payload.data || payload);
    }
  });
}

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

  if (mode !== "ranked") {
    return;
  }

  const winnerRank = ensurePlayerRank(winnerId, winnerId === getCurrentUserSync().id ? getCurrentUserSync().full_name : "Local Rival");
  const loserRank = ensurePlayerRank(loserId, loserId === getCurrentUserSync().id ? getCurrentUserSync().full_name : "Local Rival");

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
