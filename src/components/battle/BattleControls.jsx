import React from "react";
import { Button } from "@/components/ui/button";
import { canAffordAttack } from "@/lib/gameEngine";

import { X, CornerDownRight, Zap } from "lucide-react";

export default function BattleControls({ gs, myKey, isMyTurn, actionMode, onAttack, onEndTurn, onRetreat, onCancelAction }) {
  const me = gs[myKey];
  const active = me.activePokemon;

  if (!isMyTurn) {
    return (
      <div className="px-4 py-3 bg-card/80 border-t border-border text-center">
        <p className="text-muted-foreground text-sm font-body">Waiting for opponent...</p>
      </div>
    );
  }

  if (actionMode) {
    const labels = {
      energy: "Select a Pokémon to attach energy to",
      evolve: "Select a Pokémon to evolve",
      retreat: "Select a bench Pokémon to swap in",
    };
    return (
      <div className="px-4 py-3 bg-card/80 border-t border-border flex items-center gap-3">
        <div className="flex-1">
          <p className="text-sm font-body text-foreground/80">{labels[actionMode] || "Select a target"}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancelAction} className="gap-1 text-muted-foreground">
          <X className="w-4 h-4" /> Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 bg-card/80 border-t border-border space-y-2">
      {/* Attack buttons */}
      {active?.def.attacks?.map((atk, idx) => {
        const canAfford = canAffordAttack(active, atk);
        return (
          <Button key={idx} onClick={() => onAttack(idx)}
            disabled={!canAfford || active.attackedThisTurn}
            className="w-full justify-between font-body h-10 text-sm"
            variant={canAfford ? "default" : "secondary"}
          >
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4 opacity-60" />
              {atk.name}
            </span>
            <span className="font-display font-bold text-sm">
              {atk.damage ? atk.damage : "—"}
              <span className="text-xs opacity-60 ml-2 font-mono">{atk.convertedEnergyCost}E</span>
            </span>
          </Button>
        );
      })}

      {/* Secondary actions */}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" className="flex-1 font-body gap-1"
          onClick={onRetreat} disabled={me.retreatedThisTurn || !active || !me.bench.length}>
          <CornerDownRight className="w-4 h-4" /> Retreat
        </Button>
        <Button variant="outline" size="sm" className="flex-1 font-body"
          onClick={onEndTurn}>
          End Turn
        </Button>
      </div>
    </div>
  );
}