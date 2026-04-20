import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Copy, Loader2, ShieldAlert, Sparkles, Swords, Trophy, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TypeIcon, StatusBadge } from "@/lib/typeIcons";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/localDb";
import {
  buildStarterDeck,
  getCardById,
  getPokemonCards,
  getTypeStyle,
  hydrateCardsByIds,
} from "@/lib/cardCatalog";
import {
  autoPromoteAll,
  createGameState,
  endTurn,
  performAttack,
  canAffordAttack,
  setActivePokemon,
  attachEnergy,
  playBasicToBench,
  evolvePokemon,
  retreat,
  playTrainer,
} from "@/lib/gameEngine";
import { performAITurn, getAICommentary } from "@/lib/aiOpponent";
import {
  fetchRoom,
  recordMatchResult,
  subscribeToRoom,
  syncGameState,
} from "@/lib/multiplayerSync";
import { soundManager } from "@/lib/soundManager";

const AI_NAME = "Trainer Sparky";
const AI_DELAY_MS = 1400;

function clampLogs(logs) { return logs.slice(-12); }

function hpColor(pct) {
  if (pct > 0.5) return "from-emerald-500 to-green-400";
  if (pct > 0.25) return "from-yellow-500 to-amber-400";
  return "from-red-600 to-rose-500";
}

function conditionIcon(cond) {
  const map = {
    poisoned:       { label: "PSN",  color: "bg-purple-700/90" },
    badly_poisoned: { label: "BPSN", color: "bg-purple-900/90" },
    burned:         { label: "BRN",  color: "bg-red-700/90"    },
    confused:       { label: "CNF",  color: "bg-pink-700/90"   },
    paralyzed:      { label: "PAR",  color: "bg-yellow-600/90" },
    asleep:         { label: "SLP",  color: "bg-blue-700/90"   },
  };
  return map[cond] || null;
}

async function buildPlayerDef(name, cardIds) {
  const ids = cardIds?.length ? cardIds : buildStarterDeck();
  await hydrateCardsByIds(ids).catch(() => {});
  let cards = ids.map(id => getCardById(id)).filter(Boolean);
  if (!cards.length) {
    const fallbacks = getPokemonCards().slice(0, 10);
    cards = [...fallbacks, ...fallbacks.slice(0, 4)];
  }
  const deck = cards.map(c => ({
    ...c,
    supertype: c.supertype || (c.card_type === "pokemon" ? "Pokémon" : c.card_type === "energy" ? "Energy" : "Trainer"),
    stage: c.stage || (c.card_type === "pokemon" ? "basic" : null),
    hp: c.hp ? Number(c.hp) : 100,
    attacks: c.attacks?.length
      ? c.attacks
      : [{ name: c.attack1_name || "Tackle", damageValue: Number(c.attack1_damage || 20), cost: ["Colorless"], text: "" },
         ...(c.attack2_name ? [{ name: c.attack2_name, damageValue: Number(c.attack2_damage || 40), cost: ["Colorless","Colorless"], text: "" }] : [])],
    weaknesses: c.weaknesses || [],
    resistances: c.resistances || [],
    convertedRetreatCost: c.convertedRetreatCost || 1,
  }));
  while (deck.length < 20) {
    deck.push(deck[deck.length % Math.max(deck.length, 1)]);
  }
  return { name, deck };
}

function ConditionBadge({ condition }) {
  if (!condition) return null;
  const info = conditionIcon(condition);
  if (!info) return null;
  return (
    <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-display font-bold text-white tracking-wider ${info.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />
      {info.label}
    </motion.span>
  );
}

function DamageFlash({ value }) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0, scale: 1 }}
      animate={{ opacity: 0, y: -40, scale: 1.5 }}
      transition={{ duration: 1.0, ease: "easeOut" }}
      className="absolute top-2 right-3 font-display text-2xl font-black text-red-400 pointer-events-none z-20 drop-shadow-lg"
    >
      -{value}
    </motion.div>
  );
}

function PokemonCard({ playCard, isActivePlayer, isOpponent, lastDamage }) {
  const def = playCard?.def;
  const style = getTypeStyle(def?.energy_type || (def?.types?.[0] || "").toLowerCase() || "colorless");
  const hp = def?.hp ? Number(def.hp) : 100;
  const remaining = Math.max(0, hp - (playCard?.damage || 0));
  const pct = remaining / hp;
  const imageUrl = def?.image_small || def?.image_large || def?.imageSmall || def?.imageLarge;

  return (
    <div className="relative">
      <motion.div
        animate={lastDamage ? { x: [-5, 5, -3, 3, 0] } : {}}
        transition={{ duration: 0.3 }}
        className={`rounded-2xl border overflow-hidden ${isActivePlayer ? "border-primary shadow-md shadow-primary/20" : "border-border"} bg-card`}
      >
        <div className={`relative h-32 bg-gradient-to-br ${style.bg} flex items-center justify-center overflow-hidden`}>
          {imageUrl
            ? <img src={imageUrl} alt={def?.name} className="h-full w-auto object-contain drop-shadow-xl" loading="lazy" />
            : <TypeIcon type={def?.energy_type || (def?.types?.[0] || "colorless").toLowerCase()} size={52} />
          }
          {(playCard?.energyAttached?.length > 0) && (
            <div className="absolute bottom-2 left-2 flex gap-1">
              {playCard.energyAttached.slice(0, 5).map((_, i) => (
                <span key={i} className="bg-black/50 rounded-full w-5 h-5 flex items-center justify-center"><TypeIcon type="lightning" size={11} /></span>
              ))}
            </div>
          )}
          {playCard?.specialCondition && (
            <div className="absolute top-2 right-2">
              <ConditionBadge condition={playCard.specialCondition} />
            </div>
          )}
        </div>
        <div className="px-3 py-2 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="font-display font-bold text-sm leading-tight truncate">{def?.name || "Unknown"}</p>
            <span className="font-body text-xs text-muted-foreground whitespace-nowrap">{remaining}/{hp} HP</span>
          </div>
          <div className="h-2 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className={`h-full rounded-full bg-gradient-to-r ${hpColor(pct)}`}
              animate={{ width: `${pct * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {!isOpponent && def?.attacks?.slice(0, 2).map((atk, i) => (
            <p key={i} className="text-[11px] font-body text-muted-foreground truncate">
              {atk.name} — {atk.damageValue || 0} dmg • {(atk.cost||[]).join(",")||"free"}
            </p>
          ))}
        </div>
      </motion.div>
      <AnimatePresence>
        {lastDamage && <DamageFlash key={`dmg-${lastDamage}-${Date.now()}`} value={lastDamage} />}
      </AnimatePresence>
    </div>
  );
}

function PlayerField({ playerState, isOpponent, isActivePlayer, lastDamage, label, onActiveClick, onBenchClick, selectable }) {
  const active = playerState?.activePokemon;
  const bench = playerState?.bench || [];
  const prizes = playerState?.prizeCards?.length ?? 0;
  const hand = playerState?.hand?.length ?? 0;
  const deckLeft = playerState?.deck?.length ?? 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs uppercase tracking-widest font-body text-muted-foreground">{label}</p>
          {isActivePlayer && (
            <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.4 }}
              className="inline-block w-2 h-2 rounded-full bg-primary" />
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-body text-muted-foreground">
          <span className="text-[11px] font-body text-muted-foreground">Prize {6 - prizes}/6</span>
          <span className="text-[11px] font-body text-muted-foreground">Hand {hand}</span>
          <span className="text-[11px] font-body text-muted-foreground">Deck {deckLeft}</span>
        </div>
      </div>

      {active
        ? (
            <div
              onClick={onActiveClick ? () => onActiveClick(active) : undefined}
              className={`${selectable ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-background rounded-2xl cursor-pointer" : ""}`}
            >
              <PokemonCard playCard={active} isActivePlayer={isActivePlayer} isOpponent={isOpponent} lastDamage={lastDamage} />
            </div>
          )
        : <div
            onClick={onActiveClick ? () => onActiveClick(null) : undefined}
            className={`rounded-2xl border border-dashed h-36 flex items-center justify-center ${selectable ? "border-primary/60 bg-primary/5 cursor-pointer" : "border-border bg-card/50"}`}
          >
            <p className="text-sm font-body text-muted-foreground">{selectable ? "Place here" : "No Active Pokémon"}</p>
          </div>
      }

      {(bench.length > 0 || selectable) && (
        <div className="grid grid-cols-5 gap-1.5">
          {bench.map((b) => {
            const bs = getTypeStyle(b.def?.energy_type || (b.def?.types?.[0]||"").toLowerCase() || "colorless");
            const bHp = b.def?.hp ? Number(b.def.hp) : 100;
            const bPct = Math.max(0, (bHp - (b.damage||0)) / bHp);
            const bImg = b.def?.image_small || b.def?.imageSmall;
            return (
              <motion.div
                key={b.instanceId}
                layout
                onClick={onBenchClick ? () => onBenchClick(b) : undefined}
                className={`rounded-lg border overflow-hidden ${selectable ? "border-primary/60 cursor-pointer" : "border-border"} bg-card`}>
                <div className={`h-12 bg-gradient-to-br ${bs.bg} flex items-center justify-center`}>
                  {bImg ? <img src={bImg} alt={b.def?.name} className="h-full w-auto object-contain" loading="lazy" />
                    : <TypeIcon type={b.def?.energy_type || (b.def?.types?.[0] || "colorless").toLowerCase()} size={20} />}
                </div>
                <div className="h-1 bg-secondary">
                  <div className={`h-full bg-gradient-to-r ${hpColor(bPct)}`} style={{ width: `${bPct*100}%` }} />
                </div>
                {b.specialCondition && (
                  <div className="flex justify-center py-0.5"><StatusBadge condition={b.specialCondition} /></div>
                )}
                {(b.energyAttached?.length > 0) && (
                  <div className="flex justify-center gap-0.5 py-0.5 bg-black/30">
                    {b.energyAttached.slice(0, 4).map((_, i) => (
                      <span key={i} className="w-2 h-2 rounded-full bg-yellow-400/80" />
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
          {selectable && bench.length < 5 && onBenchClick && (
            <button
              onClick={() => onBenchClick(null)}
              className="rounded-lg border border-dashed border-primary/60 bg-primary/5 text-[10px] font-body text-muted-foreground h-12 hover:bg-primary/10"
            >
              Empty
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AttackButton({ attack, index, onAttack, disabled, canAfford }) {
  return (
    <motion.button
      whileHover={!disabled && canAfford ? { scale: 1.02 } : {}}
      whileTap={!disabled && canAfford ? { scale: 0.97 } : {}}
      onClick={() => !disabled && canAfford && onAttack(index)}
      disabled={disabled || !canAfford}
      className={`w-full rounded-xl border p-3 text-left transition-all ${
        canAfford && !disabled
          ? "border-primary bg-primary/10 hover:bg-primary/20 cursor-pointer"
          : "border-border bg-card opacity-50 cursor-not-allowed"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display font-bold text-sm truncate">{attack.name}</p>
          {attack.text && (
            <p className="text-[11px] font-body text-muted-foreground mt-0.5 line-clamp-1">{attack.text}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className="font-display text-xl font-black text-primary">{attack.damageValue || 0}</span>
          <div className="flex gap-0.5 flex-wrap justify-end">
            {(attack.cost || []).slice(0, 5).map((c, i) => (
              <span key={i} className="text-[10px] bg-secondary rounded-full px-1 font-body">{c.slice(0,1)}</span>
            ))}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// Classifies a card-in-hand into the gameplay action it initiates.
function handCardKind(card) {
  const d = card?.def;
  if (!d) return "unknown";
  if (d.supertype === "Energy") return "energy";
  if (d.supertype === "Trainer") return d.isSupporter ? "supporter" : (d.isStadium ? "stadium" : "item");
  if (d.supertype === "Pokémon") return d.stage === "basic" ? "basic" : "evolution";
  return "unknown";
}

function HandPanel({ hand, selectedId, onCardClick, dimmed }) {
  if (!hand?.length) {
    return (
      <div className="text-xs font-body text-muted-foreground italic">
        Your hand is empty.
      </div>
    );
  }
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      <AnimatePresence initial={false}>
        {hand.map((card, i) => {
          const kind = handCardKind(card);
          const d = card.def;
          const style = getTypeStyle(d?.energy_type || (d?.types?.[0] || "").toLowerCase() || "colorless");
          const isSel = selectedId === card.instanceId;
          const badge =
            kind === "energy"     ? { label: "Energy",     color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" }
            : kind === "basic"    ? { label: "Basic",      color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" }
            : kind === "evolution"? { label: `→ ${d.evolvesFrom || "Evo"}`, color: "bg-purple-500/20 text-purple-300 border-purple-500/30" }
            : kind === "supporter"? { label: "Supporter",  color: "bg-rose-500/20 text-rose-300 border-rose-500/30" }
            : kind === "stadium"  ? { label: "Stadium",    color: "bg-blue-500/20 text-blue-300 border-blue-500/30" }
            : kind === "item"     ? { label: "Item",       color: "bg-teal-500/20 text-teal-300 border-teal-500/30" }
            : { label: d?.supertype || "Card", color: "bg-secondary text-muted-foreground" };
          const img = d?.image_small || d?.imageSmall;
          return (
            <motion.button
              key={card.instanceId || `${i}-${d?.name}`}
              layout
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: dimmed && !isSel ? 0.55 : 1, scale: isSel ? 1.05 : 1 }}
              exit={{ y: -20, opacity: 0 }}
              whileHover={{ y: -4 }}
              onClick={() => onCardClick?.(card)}
              className={`relative flex-shrink-0 w-24 rounded-xl border overflow-hidden text-left ${isSel ? "border-primary shadow-lg shadow-primary/30" : "border-border"} bg-card`}
            >
              <div className={`h-16 bg-gradient-to-br ${style.bg} flex items-center justify-center`}>
                {img
                  ? <img src={img} alt={d?.name} className="h-full w-auto object-contain" loading="lazy" />
                  : <TypeIcon type={d?.energy_type || (d?.types?.[0] || "colorless").toLowerCase()} size={28} />}
              </div>
              <div className="p-1.5 space-y-1">
                <p className="font-display text-[11px] font-bold leading-tight truncate">{d?.name}</p>
                <span className={`inline-block rounded px-1 py-0.5 text-[9px] font-body border ${badge.color}`}>{badge.label}</span>
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function BattleLog({ entries }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [entries]);

  const style = (e) => {
    if (e.includes("Knocked Out")) return "text-red-400 font-semibold";
    if (e.includes("wins") || e.includes("Prize")) return "text-emerald-400 font-semibold";
    if (e.includes("---")) return "text-primary/60 italic";
    if (/Paralyzed|Asleep|Poisoned|Confused|Burned|Burn|Sleep|Confusion/.test(e)) return "text-purple-400";
    return "text-muted-foreground";
  };

  return (
    <div className="h-44 overflow-y-auto space-y-1 pr-1">
      {entries.map((e, i) => (
        <motion.div key={`${i}-${e}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.15 }}
          className={`text-xs font-body px-2 py-1 rounded-lg bg-background/60 border border-border/50 ${style(e)}`}>
          {e}
        </motion.div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

export default function Battle() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = urlParams.get("room");
  const playerSide = urlParams.get("player") || "player1";
  const isAI = urlParams.get("ai") === "true";
  const mode = urlParams.get("mode") || "unlimited";

  const [loading, setLoading] = useState(true);
  const [roomData, setRoomData] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiComment, setAiComment] = useState("");
  const [lastDamagePlayer, setLastDamagePlayer] = useState(null);
  const [lastDamageAI, setLastDamageAI] = useState(null);
  const [turnBanner, setTurnBanner] = useState(null);
  const [koFlash, setKoFlash] = useState(null);
  // Hand-driven action state machine. `kind` is one of:
  //   attach | bench | evolve | retreat | trainer_target | place_active
  // When set, the player's field becomes selectable and the next click on a
  // player card dispatches the action.
  const [pendingAction, setPendingAction] = useState(null);
  const recordedRef = useRef(false);
  const lastSyncedTurnRef = useRef(0);
  const lastLocalTurnRef = useRef(0);
  const seedingGameStateRef = useRef(false);

  const opponentSide = playerSide === "player1" ? "player2" : "player1";
  const playerState = gameState?.[playerSide] || null;
  const opponentState = gameState?.[opponentSide] || null;
  const isMyTurn = Boolean(gameState && gameState.phase === "main" && gameState.activePlayer === playerSide);
  const playerActive = playerState?.activePokemon;
  const attacks = playerActive?.def?.attacks || [];

  useEffect(() => { db.auth.me().then(setUser).catch(() => {}); }, []);

  // Seed the room's game_state once both decks are available. Both clients run
  // this effect, but only player1 actually writes (player2 receives via sync).
  const seedRoomGameState = useCallback(async (room) => {
    if (!room || seedingGameStateRef.current) return;
    if (room.game_state) return;
    if (!room.player1_id || !room.player2_id) return;
    if (!room.player1_deck?.length || !room.player2_deck?.length) return;
    if (playerSide !== "player1") return;
    seedingGameStateRef.current = true;
    try {
      const [p1Def, p2Def] = await Promise.all([
        buildPlayerDef(room.player1_name, room.player1_deck),
        buildPlayerDef(room.player2_name, room.player2_deck),
      ]);
      const gs = createGameState(p1Def, p2Def, mode);
      lastLocalTurnRef.current = gs.turn;
      lastSyncedTurnRef.current = gs.turn;
      setGameState(gs);
      await syncGameState(room.id, gs).catch(() => {});
    } finally {
      seedingGameStateRef.current = false;
    }
  }, [mode, playerSide]);

  useEffect(() => {
    let active = true;
    let unsubscribe = null;
    const init = async () => {
      try {
        setLoading(true); setError("");
        if (isAI && !roomId) {
          const localUser = await db.auth.me().catch(() => ({ full_name: "Trainer" }));
          if (!active) return;
          const [p1Def, p2Def] = await Promise.all([
            buildPlayerDef(localUser.full_name || "Trainer", buildStarterDeck()),
            buildPlayerDef(AI_NAME, buildStarterDeck().slice().reverse()),
          ]);
          const gs = createGameState(p1Def, p2Def, mode);
          if (!active) return;
          setGameState(gs);
          setLoading(false);
          return;
        }
        if (!roomId) { setError("No battle room provided."); setLoading(false); return; }
        const room = await fetchRoom(roomId);
        if (!active) return;
        if (!room) { setError("Battle room not found."); setLoading(false); return; }
        setRoomData(room);
        if (room.game_state) {
          lastLocalTurnRef.current = room.game_state.turn || 0;
          lastSyncedTurnRef.current = room.game_state.turn || 0;
          setGameState(room.game_state);
        } else {
          await seedRoomGameState(room);
        }
        setLoading(false);
        unsubscribe = subscribeToRoom(roomId, (upd) => {
          if (!active) return;
          setRoomData(upd);
          // Only adopt remote state if it's newer than our local copy OR if
          // the remote thinks it's now OUR turn (opponent just made a move).
          if (upd?.game_state) {
            const remoteTurn = upd.game_state.turn || 0;
            const remoteActive = upd.game_state.activePlayer;
            const localTurn = lastLocalTurnRef.current;
            const isFinished = upd.game_state.phase === "finished";
            if (
              isFinished ||
              remoteTurn > localTurn ||
              (remoteTurn === localTurn && remoteActive === playerSide)
            ) {
              lastLocalTurnRef.current = remoteTurn;
              lastSyncedTurnRef.current = remoteTurn;
              setGameState(upd.game_state);
            }
          } else {
            // Room update without game_state yet — try to seed it.
            seedRoomGameState(upd).catch(() => {});
          }
        });
      } catch (err) {
        if (active) { setError(err.message || "Unable to load battle."); setLoading(false); }
      }
    };
    init();
    return () => { active = false; if (typeof unsubscribe === "function") unsubscribe(); };
  }, [isAI, roomId, playerSide, mode, seedRoomGameState]);

  // Auto-set active Pokémon from setup phase
  useEffect(() => {
    if (!gameState || gameState.phase !== "setup") return;
    let gs = { ...gameState };
    ["player1", "player2"].forEach(pk => {
      const ps = gs[pk];
      if (!ps.activePokemon) {
        const fromHand = ps.hand.find(c => c.def?.supertype === "Pokémon" && c.def?.stage === "basic");
        const fromBench = ps.bench[0];
        const toSet = fromHand || fromBench;
        if (toSet) gs = setActivePokemon(gs, pk, toSet.instanceId);
      }
    });
    setGameState({ ...gs, phase: "main" });
  }, [gameState?.phase]);

  // AI turn
  useEffect(() => {
    if (!isAI || !gameState || gameState.phase !== "main" || gameState.activePlayer !== opponentSide) return;
    setAiThinking(true);
    setAiComment("Sparky is thinking…");
    const timer = window.setTimeout(() => {
      try {
        const prevPlayerDmg = gameState[playerSide]?.activePokemon?.damage || 0;
        const next = performAITurn(gameState);
        const newPlayerDmg = next[playerSide]?.activePokemon?.damage || 0;
        const dealt = newPlayerDmg - prevPlayerDmg;
        if (dealt > 0) {
          setLastDamagePlayer(dealt);
          soundManager.damageTaken();
          window.setTimeout(() => setLastDamagePlayer(null), 1200);
        }
        const playerKO = !next[playerSide]?.activePokemon && gameState[playerSide]?.activePokemon;
        if (playerKO) {
          setKoFlash(playerSide);
          soundManager.pokemonKO();
          window.setTimeout(() => setKoFlash(null), 900);
        }
        const aiActive = next[opponentSide]?.activePokemon;
        const hasStatus = next[playerSide]?.activePokemon?.specialCondition !== gameState[playerSide]?.activePokemon?.specialCondition;
        setAiComment(getAICommentary(Boolean(playerKO), hasStatus, aiActive?.def?.name || "Sparky"));
        lastLocalTurnRef.current = next.turn || 0;
        setGameState(next);
      } catch (err) {
        console.error("AI turn error:", err);
        try { setGameState(endTurn(gameState)); } catch { /* ignore */ }
      } finally {
        setAiThinking(false);
        window.setTimeout(() => setAiComment(""), 2800);
      }
    }, AI_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [gameState, isAI, opponentSide, playerSide]);

  // Turn change banner + turn-end sound
  useEffect(() => {
    if (!gameState || gameState.phase !== "main") return;
    const who = gameState.activePlayer === playerSide ? "Your Turn" : `${gameState[opponentSide]?.name || "Opponent"}'s Turn`;
    setTurnBanner({ key: gameState.turn, text: who });
    if (gameState.activePlayer === playerSide) soundManager.turnEnd();
    const t = window.setTimeout(() => setTurnBanner(null), 1400);
    return () => window.clearTimeout(t);
  }, [gameState?.turn, gameState?.activePlayer, gameState?.phase, playerSide, opponentSide, gameState]);

  // Victory / defeat sound
  useEffect(() => {
    if (!gameState || gameState.phase !== "finished") return;
    if (gameState.winner === playerSide) soundManager.victory();
    else soundManager.defeat();
  }, [gameState?.phase, gameState?.winner, playerSide, gameState]);

  // Record result
  useEffect(() => {
    if (!gameState || gameState.phase !== "finished" || recordedRef.current) return;
    recordedRef.current = true;
    (async () => {
      const w = gameState.winner, l = w === "player1" ? "player2" : "player1";
      const wId = roomData?.[`${w}_id`] || (w === "player1" ? user?.id : "ai_opponent");
      const lId = roomData?.[`${l}_id`] || (l === "player1" ? user?.id : "ai_opponent");
      if (wId && lId) await recordMatchResult(wId, lId, mode, gameState.turn, Math.max(1, Math.round(gameState.turn * 0.5)));
      if (roomId && roomData && !roomData.result_recorded)
        await db.entities.GameRoom.update(roomId, { result_recorded: true, status: "finished" });
    })().catch(err => console.error("record error:", err));
  }, [gameState, mode, roomData, roomId, user]);

  // Apply a reducer-style action to the local game state and push it to the
  // network. Centralised so every action path (attach/bench/evolve/retreat/
  // trainer/attack/endTurn) has consistent error handling and sync behavior.
  const applyAndSync = useCallback(async (next, extraLog) => {
    if (!next) return;
    if (next._error) {
      console.warn("Action error:", next._error);
      return;
    }
    const cleaned = autoPromoteAll({ ...next, stateVersion: (next.stateVersion || 0) + 1 });
    lastLocalTurnRef.current = cleaned.turn || 0;
    setGameState(cleaned);
    if (roomId) await syncGameState(roomId, cleaned).catch(() => {});
    if (extraLog) console.debug(extraLog);
  }, [roomId]);

  const onHandCardClick = useCallback((card) => {
    if (!isMyTurn || !playerState) return;
    const kind = handCardKind(card);
    if (kind === "energy") {
      if (playerState.energyAttachedThisTurn) return;
      setPendingAction({ kind: "attach", cardInstanceId: card.instanceId, label: `Attach ${card.def.name}` });
    } else if (kind === "basic") {
      if (!playerState.activePokemon) {
        // First basic this game — becomes active directly.
        const next = setActivePokemon(gameState, playerSide, card.instanceId);
        applyAndSync(next);
      } else if (playerState.bench.length < 5) {
        const next = playBasicToBench(gameState, playerSide, card.instanceId);
        applyAndSync(next);
      }
      setPendingAction(null);
    } else if (kind === "evolution") {
      setPendingAction({ kind: "evolve", cardInstanceId: card.instanceId, label: `Evolve into ${card.def.name}` });
    } else if (kind === "supporter" || kind === "item" || kind === "stadium") {
      // Trainer cards: some need a target, others don't.
      const n = card.def.name.toLowerCase();
      const needsTarget =
        n.includes("potion") || n.includes("switch") || n.includes("gust") || n.includes("boss") ||
        n.includes("scoop up") || n.includes("defender") || n.includes("full heal");
      if (needsTarget) {
        setPendingAction({ kind: "trainer_target", cardInstanceId: card.instanceId, label: `${card.def.name} — choose target` });
      } else {
        const next = playTrainer(gameState, playerSide, card.instanceId, {});
        applyAndSync(next);
        setPendingAction(null);
      }
    }
  }, [isMyTurn, playerState, gameState, playerSide, applyAndSync]);

  const onPlayerActiveClick = useCallback((card) => {
    if (!pendingAction || !isMyTurn) return;
    if (pendingAction.kind === "attach" && card) {
      const next = attachEnergy(gameState, playerSide, pendingAction.cardInstanceId, card.instanceId);
      applyAndSync(next);
      setPendingAction(null);
    } else if (pendingAction.kind === "evolve" && card) {
      const next = evolvePokemon(gameState, playerSide, pendingAction.cardInstanceId, card.instanceId);
      applyAndSync(next);
      setPendingAction(null);
    } else if (pendingAction.kind === "trainer_target" && card) {
      const next = playTrainer(gameState, playerSide, pendingAction.cardInstanceId, { targetInstanceId: card.instanceId });
      applyAndSync(next);
      setPendingAction(null);
    }
  }, [pendingAction, isMyTurn, gameState, playerSide, applyAndSync]);

  const onPlayerBenchClick = useCallback((card) => {
    if (!pendingAction || !isMyTurn) return;
    if (pendingAction.kind === "attach" && card) {
      const next = attachEnergy(gameState, playerSide, pendingAction.cardInstanceId, card.instanceId);
      applyAndSync(next);
      setPendingAction(null);
    } else if (pendingAction.kind === "evolve" && card) {
      const next = evolvePokemon(gameState, playerSide, pendingAction.cardInstanceId, card.instanceId);
      applyAndSync(next);
      setPendingAction(null);
    } else if (pendingAction.kind === "retreat" && card) {
      // Discard enough energy automatically (player's lowest-priority ones).
      const active = playerState.activePokemon;
      const cost = active?.def?.convertedRetreatCost || 0;
      const energyIds = (active?.energyAttached || []).slice(0, cost).map(e => e.instanceId);
      const next = retreat(gameState, playerSide, card.instanceId, energyIds);
      applyAndSync(next);
      setPendingAction(null);
    } else if (pendingAction.kind === "trainer_target" && card) {
      const next = playTrainer(gameState, playerSide, pendingAction.cardInstanceId, { benchInstanceId: card.instanceId, targetInstanceId: card.instanceId });
      applyAndSync(next);
      setPendingAction(null);
    }
  }, [pendingAction, isMyTurn, gameState, playerSide, applyAndSync, playerState]);

  const onOpponentCardClick = useCallback((card) => {
    if (!pendingAction || !isMyTurn || !card) return;
    if (pendingAction.kind === "trainer_target") {
      const next = playTrainer(gameState, playerSide, pendingAction.cardInstanceId, { benchInstanceId: card.instanceId });
      applyAndSync(next);
      setPendingAction(null);
    }
  }, [pendingAction, isMyTurn, gameState, playerSide, applyAndSync]);

  const onRetreat = useCallback(() => {
    if (!isMyTurn || !playerState?.activePokemon || playerState.bench.length === 0) return;
    setPendingAction({ kind: "retreat", label: "Choose bench Pokémon to swap in" });
  }, [isMyTurn, playerState]);

  const onEndTurn = useCallback(async () => {
    if (!isMyTurn) return;
    const next = endTurn(gameState);
    soundManager.turnEnd();
    setPendingAction(null);
    await applyAndSync(next);
  }, [isMyTurn, gameState, applyAndSync]);

  const handleAttack = useCallback(async (attackIndex) => {
    if (!isMyTurn || !gameState) return;
    try {
      const prevOppDmg = gameState[opponentSide]?.activePokemon?.damage || 0;
      const prevOppActive = gameState[opponentSide]?.activePokemon;
      soundManager.attackHit();
      const next = autoPromoteAll(performAttack(gameState, attackIndex));
      const newOppDmg = next[opponentSide]?.activePokemon?.damage || 0;
      const dealt = newOppDmg - prevOppDmg;
      if (dealt > 0) {
        setLastDamageAI(dealt);
        window.setTimeout(() => setLastDamageAI(null), 1200);
      }
      if (prevOppActive && (!next[opponentSide]?.activePokemon || next[opponentSide]?.activePokemon?.instanceId !== prevOppActive.instanceId)) {
        setKoFlash(opponentSide);
        soundManager.pokemonKO();
        window.setTimeout(() => setKoFlash(null), 900);
      }
      lastLocalTurnRef.current = next.turn || 0;
      setGameState(next);
      if (roomId) await syncGameState(roomId, next).catch(() => {});
    } catch (err) { console.error("Attack error:", err); }
  }, [isMyTurn, gameState, opponentSide, roomId]);

  const winnerLabel = useMemo(() => {
    if (!gameState?.winner) return null;
    return gameState[gameState.winner]?.name || "Winner";
  }, [gameState]);
  const isWinner = gameState?.winner === playerSide;

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-sm font-body text-muted-foreground">Preparing battle…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-6 space-y-4 text-center">
        <ShieldAlert className="w-8 h-8 text-destructive mx-auto" />
        <p className="font-display text-xl font-bold">Battle unavailable</p>
        <p className="text-sm font-body text-muted-foreground">{error}</p>
        <Button onClick={() => navigate("/lobby")} className="font-body">Return to Lobby</Button>
      </div>
    </div>
  );

  if (roomId && !roomData?.player2_id && !gameState) return (
    <div className="min-h-screen bg-background p-5">
      <div className="max-w-2xl mx-auto space-y-4 pt-10">
        <Button variant="ghost" onClick={() => navigate("/lobby")} className="font-body gap-2 px-0">
          <ArrowLeft className="w-4 h-4" /> Back to Lobby
        </Button>
        <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-4">
          <Users className="w-10 h-10 mx-auto text-primary" />
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">Waiting for opponent</p>
            <h1 className="font-display text-2xl font-bold mt-2">Room {roomData?.code}</h1>
          </div>
          <Button variant="outline" onClick={async () => navigator.clipboard.writeText(roomData?.code||"").catch(()=>{})} className="font-body gap-2">
            <Copy className="w-4 h-4" /> Copy Room Code
          </Button>
        </div>
      </div>
    </div>
  );

  if (!gameState || !playerState || !opponentState) return (
    <div className="min-h-screen bg-background p-6 flex items-center justify-center">
      <div className="text-center space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto" />
        <p className="font-display text-xl font-bold">Preparing battle</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-10 relative">
      {/* Turn banner */}
      <AnimatePresence>
        {turnBanner && (
          <motion.div
            key={turnBanner.key}
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-16 z-40 rounded-full border border-primary/40 bg-background/90 backdrop-blur px-6 py-2 shadow-lg"
          >
            <p className="font-display text-sm font-bold tracking-widest uppercase text-primary">{turnBanner.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* KO full-screen flash */}
      <AnimatePresence>
        {koFlash && (
          <motion.div
            key={`ko-${koFlash}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, times: [0, 0.3, 1] }}
            className={`pointer-events-none fixed inset-0 z-30 ${koFlash === playerSide ? "bg-red-600/40" : "bg-amber-400/40"}`}
          />
        )}
      </AnimatePresence>

      <div className="max-w-2xl mx-auto px-4 pt-6 space-y-4">

        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => navigate("/lobby")} className="font-body gap-2 px-0">
            <ArrowLeft className="w-4 h-4" /> Lobby
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="capitalize">{mode}</Badge>
            {isAI && <Badge variant="outline">vs AI</Badge>}
            {roomData?.code && <Badge variant="outline">Room {roomData.code}</Badge>}
            <Badge variant={gameState.phase === "finished" ? "default" : "outline"}>Turn {gameState.turn}</Badge>
          </div>
        </div>

        {/* Win banner */}
        <AnimatePresence>
          {winnerLabel && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-4 flex items-center gap-3 ${isWinner ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}>
              <Trophy className={`w-5 h-5 ${isWinner ? "text-emerald-400" : "text-red-400"}`} />
              <div>
                <p className="font-body font-semibold text-sm">Battle complete</p>
                <p className="text-sm font-body text-foreground/75">{winnerLabel} wins! ({gameState.log.find(l => l.includes("reason:") || l.includes("Prize") || l.includes("wins")) || ""})</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate("/lobby")} className="ml-auto font-body">Leave</Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* AI comment */}
        <AnimatePresence>
          {aiComment && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="rounded-xl border border-border bg-card/80 px-4 py-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="text-sm font-body text-foreground/80">{aiComment}</p>
              {aiThinking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground ml-auto" />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Opponent field */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <PlayerField
            playerState={opponentState}
            isOpponent={true}
            isActivePlayer={gameState.activePlayer === opponentSide}
            lastDamage={lastDamageAI}
            label={opponentState.name || "Opponent"}
            selectable={pendingAction?.kind === "trainer_target" && isMyTurn}
            onActiveClick={pendingAction?.kind === "trainer_target" && isMyTurn ? onOpponentCardClick : undefined}
            onBenchClick={pendingAction?.kind === "trainer_target" && isMyTurn ? onOpponentCardClick : undefined}
          />
        </div>

        {/* VS divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-card">
            <Swords className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-body text-muted-foreground">VS</span>
          </div>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Player field */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <PlayerField
            playerState={playerState}
            isOpponent={false}
            isActivePlayer={gameState.activePlayer === playerSide}
            lastDamage={lastDamagePlayer}
            label="You"
            selectable={Boolean(pendingAction) && isMyTurn}
            onActiveClick={pendingAction && isMyTurn ? onPlayerActiveClick : undefined}
            onBenchClick={pendingAction && isMyTurn ? onPlayerBenchClick : undefined}
          />
        </div>

        {/* Action panel */}
        {gameState.phase !== "finished" && (
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">Actions</p>
                <h2 className="font-display text-base font-bold mt-0.5">
                  {isMyTurn ? "Choose your move" : aiThinking ? "AI is thinking…" : `Waiting for ${opponentState.name}`}
                </h2>
              </div>
              {isMyTurn && <Badge className="bg-primary/20 text-primary border-primary/30">Your Turn</Badge>}
            </div>

            {isMyTurn ? (
              <div className="space-y-3">
                {pendingAction && (
                  <div className="rounded-xl border border-primary/40 bg-primary/10 px-3 py-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-body text-foreground/90">{pendingAction.label}</p>
                    <Button size="sm" variant="ghost" onClick={() => setPendingAction(null)} className="h-7 font-body">Cancel</Button>
                  </div>
                )}

                {/* Hand strip */}
                <div>
                  <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-body mb-1">Hand</p>
                  <HandPanel
                    hand={playerState.hand || []}
                    selectedId={pendingAction?.cardInstanceId}
                    onCardClick={onHandCardClick}
                    dimmed={Boolean(pendingAction)}
                  />
                </div>

                {/* Attacks (only when an Active Pokémon is present) */}
                {playerActive && attacks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-body">Attacks</p>
                    {attacks.map((atk, idx) => (
                      <AttackButton key={idx} attack={atk} index={idx} onAttack={handleAttack}
                        disabled={!isMyTurn || Boolean(pendingAction)} canAfford={canAffordAttack(playerActive, atk)} />
                    ))}
                  </div>
                )}

                {/* Turn controls */}
                <div className="flex flex-wrap gap-2">
                  {playerState.activePokemon && playerState.bench.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={Boolean(pendingAction)}
                      onClick={onRetreat}
                      className="font-body"
                    >
                      Retreat
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    disabled={Boolean(pendingAction)}
                    onClick={onEndTurn}
                    className="font-body ml-auto"
                  >
                    End Turn
                  </Button>
                </div>

                {!playerState.activePokemon && (
                  <p className="text-xs font-body text-yellow-400">
                    Pick a Basic Pokémon from your hand to place as Active.
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                {aiThinking && <Loader2 className="w-4 h-4 animate-spin" />}
                {isAI && !isMyTurn && !aiThinking && (
                  <span className="flex items-center gap-1">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Sparky is preparing their move…
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Battle log */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <h2 className="font-display text-sm font-bold">Battle Log</h2>
          <BattleLog entries={clampLogs(gameState.log || [])} />
        </div>

      </div>
    </div>
  );
}
