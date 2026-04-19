import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Crown, Loader2, Shield, Star, Swords, Trophy, Users } from "lucide-react";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/AuthContext";
import db from "@/lib/localDb";
import { buildStarterDeck } from "@/lib/cardCatalog";
import { buildBalancedDeck, buildAggressiveDeck, buildStallDeck } from "@/lib/aiDeckBuilder";
import { createRoom, joinRoom } from "@/lib/multiplayerSync";

const TABS = [
  { id: "play", label: "Play", icon: Swords },
  { id: "ranked", label: "Ranked", icon: Trophy },
  { id: "leaderboard", label: "Leaderboard", icon: Crown },
];

const TIER_STYLES = {
  bronze: { color: "text-orange-400", bg: "bg-orange-400/10", abbr: "BR" },
  silver: { color: "text-slate-300", bg: "bg-slate-300/10", abbr: "SI" },
  gold: { color: "text-yellow-400", bg: "bg-yellow-400/10", abbr: "GO" },
  platinum: { color: "text-cyan-300", bg: "bg-cyan-300/10", abbr: "PL" },
  diamond: { color: "text-blue-400", bg: "bg-blue-400/10", abbr: "DI" },
  master: { color: "text-purple-400", bg: "bg-purple-400/10", abbr: "MA" },
};

export default function Lobby() {
  const navigate = useNavigate();
  const { user, renameUser } = useAuth();
  const [tab, setTab] = useState("play");
  const [mode, setMode] = useState("unlimited");
  const [roomCode, setRoomCode] = useState("");
  const [displayName, setDisplayName] = useState(user?.full_name || "Local Player");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.full_name) {
      setDisplayName(user.full_name);
    }
  }, [user]);

  const { data: myRank } = useQuery({
    queryKey: ["my-rank", user?.id],
    queryFn: async () => {
      const records = await db.entities.PlayerRank.filter({ user_id: user?.id });
      return records[0] || null;
    },
    enabled: Boolean(user?.id),
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => db.entities.PlayerRank.list("-elo", 20),
    refetchInterval: 3000,
  });

  const { data: openRooms = [] } = useQuery({
    queryKey: ["open-rooms"],
    queryFn: () => db.entities.GameRoom.filter({ status: "waiting" }),
    refetchInterval: 2000,
  });

  const persistName = async () => {
    if (!displayName.trim()) {
      return;
    }
    await renameUser(displayName.trim());
  };

  const handleCreate = async (selectedMode) => {
    try {
      setLoading(true);
      setError("");
      await persistName();
      const deckBuilders = [buildBalancedDeck, buildAggressiveDeck, buildStallDeck];
      const deckBuilder = deckBuilders[Math.floor(Math.random() * deckBuilders.length)];
      const room = await createRoom(displayName.trim() || user?.full_name || "Local Player", selectedMode, deckBuilder());
      navigate(`/battle?room=${room.id}&player=player1&mode=${selectedMode}`);
    } catch (actionError) {
      setError(actionError.message || "Unable to create room.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (code) => {
    try {
      setLoading(true);
      setError("");
      await persistName();
      const deckBuilders = [buildBalancedDeck, buildAggressiveDeck, buildStallDeck];
      const deckBuilder = deckBuilders[Math.floor(Math.random() * deckBuilders.length)];
      const room = await joinRoom(code.trim().toUpperCase(), displayName.trim() || user?.full_name || "Local Player", deckBuilder());
      navigate(`/battle?room=${room.id}&player=player2&mode=${room.mode}`);
    } catch (actionError) {
      setError(actionError.message || "Unable to join room.");
    } finally {
      setLoading(false);
    }
  };

  const currentTier = TIER_STYLES[myRank?.rank_tier] || TIER_STYLES.bronze;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-8 space-y-5">
        <PageHeader title="PLAY" subtitle="Local single-browser rebuild" />

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">Local profile</p>
              <h2 className="font-display text-lg font-bold mt-1">{user?.full_name || "Local Player"}</h2>
            </div>
            <Badge variant="secondary">No Base44</Badge>
          </div>

          <div className="flex gap-2">
            <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="font-body" />
            <Button variant="outline" onClick={persistName} className="font-body">
              Save Name
            </Button>
          </div>
        </div>

        {myRank && (
          <div className={`rounded-2xl border border-border p-4 flex items-center gap-4 ${currentTier.bg}`}>
            <span className={`font-display text-xl font-black ${currentTier.color}`}>{currentTier.abbr}</span>
            <div className="flex-1">
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">Current rank</p>
              <p className={`font-display text-lg font-bold capitalize ${currentTier.color}`}>{myRank.rank_tier}</p>
              <p className="text-sm font-body text-foreground/70">ELO {myRank.elo} · {myRank.wins}W / {myRank.losses}L</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-xl border p-3 text-sm font-body flex flex-col items-center gap-2 ${
                tab === id ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-body text-red-300">
            {error}
          </div>
        )}

        {tab === "play" && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm font-body text-muted-foreground">
                  Open a room in one tab and join it from another tab to simulate local multiplayer.
                </p>
              </div>

              <div className="flex gap-2">
                {[
                  ["unlimited", "Unlimited"],
                  ["standard", "Standard"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMode(value)}
                    className={`px-3 py-2 rounded-lg text-sm font-body border ${
                      mode === value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Button onClick={() => handleCreate(mode)} className="font-body gap-2" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Create Room
                </Button>
                <Button variant="outline" onClick={() => navigate(`/battle?ai=true&mode=${mode}`)} className="font-body gap-2">
                  <Star className="w-4 h-4" />
                  Battle AI
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  className="font-body"
                />
                <Button variant="outline" onClick={() => handleJoin(roomCode)} className="font-body" disabled={!roomCode.trim() || loading}>
                  Join
                </Button>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Open Rooms</h2>
                <Badge variant="secondary">{openRooms.length}</Badge>
              </div>

              {openRooms.length === 0 ? (
                <p className="text-sm font-body text-muted-foreground">No waiting rooms yet. Create one to start a local multiplayer test.</p>
              ) : (
                <div className="space-y-2">
                  {openRooms.map((room) => (
                    <div key={room.id} className="rounded-xl border border-border bg-background p-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="font-body font-semibold text-sm">Room {room.code}</p>
                        <p className="text-xs text-muted-foreground font-body">
                          {room.player1_name} · {room.mode}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleJoin(room.code)} className="font-body" disabled={loading}>
                        Join
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "ranked" && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
            <h2 className="font-display text-lg font-bold">Ranked Queue</h2>
            <p className="text-sm font-body text-muted-foreground">
              Ranked games use the same local battle flow, but match results update your local ELO and leaderboard.
            </p>
            <Button onClick={() => handleCreate("ranked")} className="font-body gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
              Create Ranked Room
            </Button>
          </div>
        )}

        {tab === "leaderboard" && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">Leaderboard</h2>
              <Badge variant="secondary">Top {leaderboard.length}</Badge>
            </div>

            <div className="space-y-2">
              {leaderboard.map((entry, index) => {
                const tier = TIER_STYLES[entry.rank_tier] || TIER_STYLES.bronze;
                return (
                  <div key={entry.id} className="rounded-xl border border-border bg-background p-3 flex items-center gap-3">
                    <div className="w-8 text-center font-display font-bold text-muted-foreground">#{index + 1}</div>
                    <div className={`font-display text-base font-black ${tier.color}`}>{tier.abbr}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-sm truncate">{entry.username}</p>
                      <p className="text-xs text-muted-foreground font-body">
                        ELO {entry.elo} · {entry.wins || 0}W / {entry.losses || 0}L
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">{entry.rank_tier}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
