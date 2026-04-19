import React from "react";
import { motion } from "framer-motion";
import ActivePokemonSlot from "./ActivePokemonSlot";
import BenchSlot from "./BenchSlot";
import PrizeCards from "./PrizeCards";
import BattleControls from "./BattleControls";
import { ScrollText } from "lucide-react";

export default function BattleField({
  gs, myKey, oppKey, isMyTurn,
  selectedCard, actionMode,
  onCardClick, onAttack, onEndTurn, onRetreat, onCancelAction, onOpenLog
}) {
  const me = gs[myKey];
  const opp = gs[oppKey];

  return (
    <div className="flex-1 flex flex-col overflow-hidden select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-card/80 backdrop-blur border-b border-border">
        <div className="flex items-center gap-2">
          <span className="font-display text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Turn {gs.turn}
          </span>
          <span className={`text-xs font-body px-2 py-0.5 rounded-full ${isMyTurn ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
            {isMyTurn ? "Your turn" : `${opp.name}'s turn`}
          </span>
        </div>
        <button onClick={onOpenLog} className="p-1.5 rounded-lg bg-secondary hover:bg-muted transition-colors">
          <ScrollText className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Opponent side */}
      <div className="flex-1 flex flex-col bg-gradient-to-b from-red-950/20 to-background px-3 py-2">
        {/* Opp info */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-xs font-bold text-red-400/80 uppercase">{opp.name}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs font-body text-muted-foreground">Hand: {opp.hand.length}</span>
            <span className="text-xs font-body text-muted-foreground">Deck: {opp.deck.length}</span>
          </div>
        </div>

        {/* Opp bench */}
        <div className="flex gap-1.5 mb-2 min-h-[60px]">
          {opp.bench.map(p => (
            <BenchSlot key={p.instanceId} pokemon={p} isOpponent size="sm"
              onClick={() => actionMode === "boss" && onCardClick(p, "opp-bench")} />
          ))}
          {Array.from({ length: 5 - opp.bench.length }).map((_, i) => (
            <div key={i} className="w-[52px] h-[60px] rounded-lg border border-dashed border-border/30" />
          ))}
        </div>

        {/* Opp active */}
        <div className="flex justify-center mb-2">
          <ActivePokemonSlot pokemon={opp.activePokemon} isOpponent label={opp.name} />
        </div>

        {/* Prize cards */}
        <div className="flex items-center gap-2 justify-center">
          <PrizeCards count={opp.prizeCards.length} isOpponent />
        </div>
      </div>

      {/* Middle separator */}
      <div className="h-px bg-border mx-4" />

      {/* Player side */}
      <div className="flex-1 flex flex-col bg-gradient-to-t from-blue-950/20 to-background px-3 py-2">
        {/* Prize cards */}
        <div className="flex items-center gap-2 justify-center mb-2">
          <PrizeCards count={me.prizeCards.length} isOpponent={false} />
        </div>

        {/* My active */}
        <div className="flex justify-center mb-2">
          <ActivePokemonSlot
            pokemon={me.activePokemon} isOpponent={false} label="You"
            isMyTurn={isMyTurn} actionMode={actionMode}
            onClick={() => me.activePokemon && onCardClick(me.activePokemon, "active")}
          />
        </div>

        {/* My bench */}