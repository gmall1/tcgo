import React from "react";
import { Button } from "@/components/ui/button";
import { ScrollText, Loader2, X } from "lucide-react";

export default function BattleActionBar({
  isMyTurn, myState, onAttack, onEndTurn, onToggleLog, saving, gameState, pendingAction, onCancelAction
}) {
  const active = myState?.active;
  const attacks = active?.card?.attacks || [];

  return (
    <div className="bg-card/80 backdrop-blur-sm border-y border-border px-3 py-2 space-y-2">
      {/* Turn indicator */}
      <div className="flex items-center justify-between">
        <div className={`px-3 py-1 rounded-full text-xs font-body font-bold ${isMyTurn ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
          {isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
        </div>
        <span className="text-muted-foreground text-xs font-body">Turn {gameState?.turn}</span>
        <button onClick={onToggleLog} className="text-muted-foreground hover:text-foreground">
          <ScrollText className="w-4 h-4" />
        </button>
      </div>

      {/* Pending action prompt */}
      {pendingAction && (
        <div className="flex items-center justify-between bg-accent/10 border border-accent/30 rounded-xl px-3 py-2">
          <span className="text-accent text-xs font-body">
            {pendingAction === "play_active" && "Tap to place as Active Pokémon"}
            {pendingAction === "play_bench" && "Tap field to bench this Pokémon"}
            {pendingAction === "attach" && "Tap a Pokémon in play to attach energy"}
          </span>
          <button onClick={onCancelAction}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
      )}

      {/* Attack buttons */}
      {isMyTurn && active && attacks.length > 0 && !pendingAction && (
        <div className="flex gap-2">
          {attacks.map((atk, i) => (
            <Button
              key={i}
              size="sm"
              onClick={() => onAttack(i)}
              disabled={myState.attackedThisTurn || saving}
              className="flex-1 font-body text-xs justify-between px-3 h-9"
              variant={myState.attackedThisTurn ? "secondary" : "default"}
            >
              <span className="truncate">{atk.name}</span>
              <span className="font-display font-bold ml-1 flex-shrink-0">{atk.damage || "—"}</span>
            </Button>
          ))}
        </div>
      )}

      {/* End Turn */}
      {isMyTurn && !pendingAction && (
        <Button
          size="sm"
          variant="outline"
          onClick={onEndTurn}
          disabled={saving}
          className="w-full font-body text-xs h-8"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          End Turn
        </Button>
      )}
    </div>
  );
}