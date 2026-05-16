import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Swords, Layers, FolderOpen, Zap, Users, Shield, RotateCcw, Coins, ShoppingBag, Star, Trophy } from "lucide-react";
import BottomNav from "@/components/tcg/BottomNav";
import CardFlowBackground from "@/components/home/CardFlowBackground";

export default function Home() {
  return (
    <div className="min-h-screen bg-background pb-24 overflow-hidden">
      {/* Hero */}
      <div className="relative overflow-hidden min-h-[46vh] flex items-end">
        <CardFlowBackground density={24} tint="crimson" />
        <div className="absolute top-4 right-4 font-black text-[96px] leading-none text-white/5 select-none tracking-tighter">TCG</div>
        <div className="relative px-5 pb-8 pt-16">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
            <p className="text-red-200/80 font-display text-[11px] font-bold tracking-[0.2em] uppercase mb-1">Pokémon</p>
            <h1 className="font-display text-5xl font-black text-white leading-none tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]">
              TCG<br />LIVE
            </h1>
            <p className="text-white/75 font-body text-sm mt-3 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">Full rules. Real cards. Every mechanic.</p>
          </motion.div>
        </div>
      </div>

      <div className="px-4 mt-5 space-y-5">
        {/* Primary: Battle */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Link to="/lobby">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-800 to-red-950 p-5 min-h-[110px] flex flex-col justify-between group border border-red-900/50">
              <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-200" />
              <div className="absolute -right-4 -top-4 w-28 h-28 rounded-full bg-red-700/20" />
              <span className="self-start text-[10px] font-display font-bold px-2.5 py-1 rounded-full bg-red-600/60 text-red-200 tracking-wider uppercase">Live Match</span>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-display text-2xl font-black text-white tracking-tight">BATTLE</p>
                  <p className="text-red-300/60 text-xs font-body mt-0.5">vs AI or vs Player</p>
                </div>
                <Swords className="w-8 h-8 text-red-400/60" />
              </div>
            </div>
          </Link>
        </motion.div>

        {/* Mode cards */}
        <div className="grid grid-cols-2 gap-3">
          {[
            // Both mode tiles route through the lobby so the player always
            // gets the deck picker before the match starts. The lobby reads
            // the `mode` query param to pre-select the matching format.
            { to: "/lobby?mode=unlimited", gradient: "from-red-900 to-black",  label: "UNLIMITED", sub: "All cards legal", Icon: Zap, delay: 0.18 },
            { to: "/lobby?mode=standard",  gradient: "from-zinc-800 to-black", label: "STANDARD",  sub: "Legal sets only", Icon: Shield, delay: 0.22 },
          ].map(({ to, gradient, label, sub, Icon, delay }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
              <Link to={to}>
                <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 min-h-[88px] flex flex-col justify-between group border border-white/5`}>
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors" />
                  <Icon className="w-5 h-5 text-white/40" />
                  <div>
                    <p className="font-display text-base font-black text-white tracking-tight">{label}</p>
                    <p className="text-white/40 text-[11px] font-body">{sub}</p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Collection links */}
        <div>
          <p className="font-display text-[11px] text-muted-foreground font-bold uppercase tracking-[0.15em] mb-3">Collection</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/decks", Icon: FolderOpen, label: "My Decks", sub: "Build and manage" },
              { to: "/collection", Icon: Layers, label: "Card Dex", sub: "Browse all cards" },
            ].map(({ to, Icon, label, sub }) => (
              <Link key={to} to={to}>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-secondary/60 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-foreground/70" />
                  </div>
                  <div>
                    <p className="font-body font-semibold text-sm">{label}</p>
                    <p className="text-muted-foreground text-[11px] font-body">{sub}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Live features */}
        <div>
          <p className="font-display text-[11px] text-muted-foreground font-bold uppercase tracking-[0.15em] mb-3">Live Features</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { to: "/pack-shop", Icon: ShoppingBag, label: "Pack Shop", sub: "Open boosters" },
              { to: "/battle-pass", Icon: Trophy, label: "Battle Pass", sub: "Earn season rewards" },
            ].map(({ to, Icon, label, sub }) => (
              <Link key={to} to={to}>
                <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 hover:bg-secondary/60 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4 h-4 text-foreground/70" />
                  </div>
                  <div>
                    <p className="font-body font-semibold text-sm">{label}</p>
                    <p className="text-muted-foreground text-[11px] font-body">{sub}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Featured deck */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Link to="/decks">
            <div className="relative overflow-hidden rounded-2xl border border-yellow-400/20 bg-gradient-to-br from-yellow-600/20 via-card to-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-yellow-400" />
                <p className="font-display text-[11px] font-bold tracking-[0.15em] uppercase text-yellow-300">Featured Deck</p>
              </div>
              <p className="font-display text-xl font-black">Thunder Rush</p>
              <p className="text-xs font-body text-muted-foreground mt-1">Aggro Lightning premade deck tuned for fast ladder wins.</p>
            </div>
          </Link>
        </motion.div>

        {/* Features list */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="font-display text-[11px] text-muted-foreground font-bold uppercase tracking-[0.15em] mb-4">Engine Features</p>
            <div className="space-y-3">
              {[
                [Swords,      "Full battle rules — prize cards, bench, active"],
                [Layers,      "Live PokemonTCG.io card database"],
                [Users,       "Multiplayer via room codes"],
                [Shield,      "Special conditions: Poison, Burn, Sleep, Paralyze, Confuse"],
                [Coins,       "Coin flips for attack effects"],
                [RotateCcw,   "Weakness and resistance calculations"],
              ].map(([Icon, text]) => (
                <div key={text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="w-3.5 h-3.5 text-foreground/60" />
                  </div>
                  <span className="text-sm font-body text-foreground/70">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
