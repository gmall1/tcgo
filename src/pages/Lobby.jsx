import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Check,
  Crown,
  Globe2,
  Laptop,
  Layers,
  Loader2,
  Share2,
  Shield,
  Star,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import db from "@/lib/localDb";
import { buildBalancedDeck, buildAggressiveDeck, buildStallDeck } from "@/lib/aiDeckBuilder";
import { createRoom, joinRoom, listOpenRooms } from "@/lib/multiplayerSync";
import { getBackendUrl, isNetworkAvailable, pingBackend, setBackendUrl } from "@/lib/networkClient";

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

const AUTO_DECK_ID = "auto";

function randomAutoDeck() {
  const builders = [buildBalancedDeck, buildAggressiveDeck, buildStallDeck];
  return builders[Math.floor(Math.random() * builders.length)]();
}

export default function Lobby() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, renameUser } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState("play");
  // Pre-select the format from `?mode=...` so Home's mode tiles land here
  // with the right format already chosen.
  const initialMode = ["unlimited", "standard"].includes(searchParams.get("mode"))
    ? searchParams.get("mode")
    : "unlimited";
  const [mode, setMode] = useState(initialMode);
  const [roomCode, setRoomCode] = useState(searchParams.get("code") || "");
  const [displayName, setDisplayName] = useState(user?.full_name || "Local Player");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedDeckId, setSelectedDeckId] = useState(AUTO_DECK_ID);
  const [autoDeckSeed, setAutoDeckSeed] = useState(0);
  const [aiLevel, setAiLevel] = useState("balanced");
  const [aiSpeed, setAiSpeed] = useState("normal");
  const [networkEnabled, setNetworkEnabled] = useState(isNetworkAvailable());
  const [backendUrl, setBackendUrlState] = useState(getBackendUrl());
  const [backendStatus, setBackendStatus] = useState(null);
  const [lastCreatedRoom, setLastCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.full_name) setDisplayName(user.full_name);
  }, [user]);

  // Ping backend once on mount (and whenever URL changes) so the user gets a
  // live "online/offline" dot.
  useEffect(() => {
    let alive = true;
    if (!backendUrl) {
      setBackendStatus(null);
      return () => {};
    }
    pingBackend(backendUrl).then((result) => {
      if (!alive) return;
      setBackendStatus(result);
    });
    return () => {
      alive = false;
    };
  }, [backendUrl]);

  const { data: myRank } = useQuery({
    queryKey: ["my-rank", user?.id],
    queryFn: async () => {
      const records = await db.entities.PlayerRank.filter({ user_id: user?.id });
      return records[0] || null;
    },
    enabled: Boolean(user?.id),
  });

  // Show every saved deck the player can pick: ones they built (which carry
  // their user_id) plus the seeded premade decks (which intentionally have
  // no owner). Filtering strictly by user_id used to hide both premades and
  // anything imported before login, which made the deck picker look broken.
  const { data: decks = [] } = useQuery({
    queryKey: ["decks", user?.id],
    queryFn: async () => {
      const all = await db.entities.Deck.list("-updated_date", 100);
      if (!user?.id) return all;
      return all.filter((d) => !d.user_id || d.user_id === user.id);
    },
  });

  const { data: leaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => db.entities.PlayerRank.list("-elo", 20),
    refetchInterval: 3000,
  });

  const { data: openRooms = [] } = useQuery({
    queryKey: ["open-rooms", networkEnabled],
    queryFn: () => listOpenRooms(),
    refetchInterval: 2500,
  });

  const persistName = async () => {
    if (!displayName.trim()) return;
    await renameUser(displayName.trim());
  };

  // Decks are persisted with `card_ids` (not `cards`) — see DeckBuilder save
  // and premadeDecks seed. The earlier `deck.cards` lookup always missed,
  // which is why "choose your own deck" silently fell through to a random
  // auto-deck. Always resolve via card_ids.
  const resolveDeck = useMemo(() => {
    return () => {
      if (selectedDeckId === AUTO_DECK_ID) {
        // autoDeckSeed intentionally lives in deps so "Shuffle Auto Deck"
        // forces a fresh randomized build for this run.
        void autoDeckSeed;
        return randomAutoDeck();
      }
      const deck = decks.find((d) => d.id === selectedDeckId);
      if (!deck?.card_ids?.length) return randomAutoDeck();
      return deck.card_ids;
    };
  }, [autoDeckSeed, decks, selectedDeckId]);

  const handleCreate = async (selectedMode) => {
    try {
      setLoading(true);
      setError("");
      setLastCreatedRoom(null);
      await persistName();
      const deck = resolveDeck();
      const room = await createRoom(
        displayName.trim() || user?.full_name || "Local Player",
        selectedMode,
        deck,
        { network: networkEnabled }
      );
      setLastCreatedRoom(room);
      if (!networkEnabled) {
        navigate(`/battle?room=${room.id}&player=player1&mode=${selectedMode}`);
      }
    } catch (actionError) {
      setError(actionError.message || "Unable to create room.");
    } finally {
      setLoading(false);
    }
  };

  // Quick "Battle vs AI" — uses the same deck the player picked above and
  // jumps straight into a single-player match. Previously the only way to
  // start a match from the lobby was to spin up a multiplayer room and wait
  // for an opponent, so picking a deck here had no effect on AI battles.
  const handlePlayVsAI = (selectedMode) => {
    persistName().catch(() => {});
    const params = new URLSearchParams();
    params.set("mode", selectedMode);
    params.set("ai", "true");
    params.set("aiLevel", aiLevel);
    params.set("aiSpeed", aiSpeed);
    if (selectedDeckId && selectedDeckId !== AUTO_DECK_ID) {
      params.set("deckId", selectedDeckId);
    }
    navigate(`/battle?${params.toString()}`);
  };

  const handleJoin = async (code) => {
    try {
      setLoading(true);
      setError("");
      await persistName();
      const deck = resolveDeck();
      const room = await joinRoom(
        (code || "").trim().toUpperCase(),
        displayName.trim() || user?.full_name || "Local Player",
        deck,
        { network: networkEnabled }
      );
      navigate(`/battle?room=${room.id}&player=player2&mode=${room.mode}`);
    } catch (actionError) {
      setError(actionError.message || "Unable to join room.");
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = useMemo(() => {
    if (!lastCreatedRoom?.code) return "";
    if (typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    url.searchParams.set("code", lastCreatedRoom.code);
    return url.toString();
  }, [lastCreatedRoom]);

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: "Link copied", description: "Send it to your opponent." });
    } catch {
      toast({ title: "Copy failed", description: "Select and copy the link manually." });
    }
  };

  const enterRoom = () => {
    if (!lastCreatedRoom) return;
    navigate(`/battle?room=${lastCreatedRoom.id}&player=player1&mode=${lastCreatedRoom.mode}`);
  };

  const applyBackendUrl = async () => {
    const next = setBackendUrl(backendUrl.trim());
    setBackendUrlState(next);
    if (!next) {
      setNetworkEnabled(false);
      setBackendStatus(null);
      toast({ title: "Network disabled", description: "Falling back to local multiplayer." });
      return;
    }
    const status = await pingBackend(next);
    setBackendStatus(status);
    if (status.ok) {
      setNetworkEnabled(true);
      toast({ title: "Backend reachable", description: "Network play enabled." });
    } else {
      toast({
        title: "Cannot reach backend",
        description: status.reason || "Check the URL and CORS settings.",
      });
    }
  };

  const currentTier = TIER_STYLES[myRank?.rank_tier] || TIER_STYLES.bronze;
  const autoCode = roomCode.trim().length === 6;
  const networkBadge = networkEnabled
    ? backendStatus?.ok
      ? { label: "Online", color: "bg-emerald-500/20 text-emerald-400" }
      : { label: "Connecting…", color: "bg-amber-500/20 text-amber-300" }
    : { label: "Local only", color: "bg-muted text-muted-foreground" };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-5 pt-8 space-y-5 max-w-4xl mx-auto">
        <PageHeader
          title="PLAY"
          subtitle={networkEnabled ? "Network + local multiplayer" : "Local multiplayer (no backend)"}
        />

        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">Local profile</p>
              <h2 className="font-display text-lg font-bold mt-1">{user?.full_name || "Local Player"}</h2>
            </div>
            <Badge className={`${networkBadge.color} border-0 font-body`}>{networkBadge.label}</Badge>
          </div>

          <div className="flex gap-2">
            <Input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              className="font-body"
            />
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
              <p className="text-sm font-body text-foreground/70">
                ELO {myRank.elo} · {myRank.wins}W / {myRank.losses}L
              </p>
            </div>
          </div>
        )}

        {/* Connection settings */}
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {networkEnabled ? <Globe2 className="w-4 h-4 text-emerald-400" /> : <Laptop className="w-4 h-4" />}
              <p className="font-display text-sm font-bold">Multiplayer transport</p>
            </div>
            <button
              onClick={() => setNetworkEnabled((v) => !v && Boolean(getBackendUrl()))}
              disabled={!getBackendUrl()}
              className={`text-xs font-body px-3 py-1.5 rounded-full border transition-colors ${
                networkEnabled
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-secondary"
              } ${!getBackendUrl() ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {networkEnabled ? "Network" : "Local only"}
            </button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Input
              value={backendUrl}
              onChange={(e) => setBackendUrlState(e.target.value)}
              placeholder="https://your-tcgo-backend.example.com"
              className="font-mono text-xs"
            />
            <Button variant="outline" size="sm" onClick={applyBackendUrl} className="font-body">
              Connect
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground font-body">
            Point this at any tcgo-backend instance to play across browsers. Leave blank to keep
            local (single-browser) play.
          </p>
        </div>

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
                  {networkEnabled
                    ? "Create a room and share the link — your opponent can join from any browser."
                    : "Open a room here and join from another tab to simulate local multiplayer."}
                </p>
              </div>

              <div>
                <p className="text-xs font-body text-muted-foreground mb-1.5 uppercase tracking-widest">
                  Deck
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setSelectedDeckId(AUTO_DECK_ID)}
                    className={`px-3 py-1.5 rounded-full text-xs font-body border flex items-center gap-1.5 ${
                      selectedDeckId === AUTO_DECK_ID
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border"
                    }`}
                  >
                    <Layers className="w-3 h-3" /> Auto
                  </button>
                  {decks.map((deck) => (
                    <button
                      key={deck.id}
                      onClick={() => setSelectedDeckId(deck.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-body border ${
                        selectedDeckId === deck.id
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border"
                      }`}
                    >
                      {deck.name || "Untitled"}
                    </button>
                  ))}
                  {selectedDeckId === AUTO_DECK_ID && (
                    <button
                      onClick={() => setAutoDeckSeed(Date.now())}
                      className="px-3 py-1.5 rounded-full text-xs font-body border border-border bg-background hover:bg-secondary"
                    >
                      Shuffle Auto Deck
                    </button>
                  )}
                  {decks.length === 0 && (
                    <button
                      onClick={() => navigate("/deck-builder")}
                      className="px-3 py-1.5 rounded-full text-xs font-body border border-dashed border-border text-muted-foreground hover:bg-secondary"
                    >
                      + Build a deck
                    </button>
                  )}
                </div>
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
                <div>
                  <p className="text-xs font-body text-muted-foreground mb-1.5 uppercase tracking-widest">AI style</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      ["aggressive", "Aggro"],
                      ["balanced", "Balanced"],
                      ["stall", "Control"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAiLevel(value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-body border ${
                          aiLevel === value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-body text-muted-foreground mb-1.5 uppercase tracking-widest">AI pace</p>
                  <div className="flex gap-2 flex-wrap">
                    {[
                      ["fast", "Fast"],
                      ["normal", "Normal"],
                      ["slow", "Cinematic"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setAiSpeed(value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-body border ${
                          aiSpeed === value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Button onClick={() => handleCreate(mode)} className="font-body gap-2" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                  Create Room
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handlePlayVsAI(mode)}
                  className="font-body gap-2"
                >
                  <Star className="w-4 h-4" />
                  Battle AI
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
                  placeholder="Enter room code"
                  className="font-body font-mono uppercase"
                />
                <Button
                  variant="outline"
                  onClick={() => handleJoin(roomCode)}
                  className="font-body"
                  disabled={!autoCode || loading}
                >
                  Join
                </Button>
              </div>

              {lastCreatedRoom && (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-body text-muted-foreground uppercase tracking-widest">
                        Your room is ready
                      </p>
                      <p className="font-display text-lg font-bold tracking-[0.3em]">
                        {lastCreatedRoom.code}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {shareUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyShareUrl}
                          className="font-body gap-1.5"
                        >
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}
                          {copied ? "Copied" : "Copy link"}
                        </Button>
                      )}
                      <Button size="sm" onClick={enterRoom} className="font-body gap-1.5">
                        <Swords className="w-3.5 h-3.5" /> Enter room
                      </Button>
                    </div>
                  </div>
                  {shareUrl && (
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{shareUrl}</p>
                  )}
                </div>
              )}
            </div>

            <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold">Open Rooms</h2>
                <Badge variant="secondary">{openRooms.length}</Badge>
              </div>

              {openRooms.length === 0 ? (
                <p className="text-sm font-body text-muted-foreground">
                  No waiting rooms yet. Create one — friends can then join by code.
                </p>
              ) : (
                <div className="space-y-2">
                  {openRooms.map((room) => (
                    <div
                      key={room.id}
                      className="rounded-xl border border-border bg-background p-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-body font-semibold text-sm">Room {room.code}</p>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {room._transport === "network" ? "network" : "local"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground font-body">
                          {room.player1_name} · {room.mode}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleJoin(room.code)}
                        className="font-body"
                        disabled={loading}
                      >
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
              Ranked games use the same battle flow, but match results update your local ELO and leaderboard.
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
                  <div
                    key={entry.id}
                    className="rounded-xl border border-border bg-background p-3 flex items-center gap-3"
                  >
                    <div className="w-8 text-center font-display font-bold text-muted-foreground">#{index + 1}</div>
                    <div className={`font-display text-base font-black ${tier.color}`}>{tier.abbr}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-sm truncate">{entry.username}</p>
                      <p className="text-xs text-muted-foreground font-body">
                        ELO {entry.elo} · {entry.wins || 0}W / {entry.losses || 0}L
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {entry.rank_tier}
                    </Badge>
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
