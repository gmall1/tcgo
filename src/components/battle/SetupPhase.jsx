import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";

export default function SetupPhase({ gs, myKey, onReady }) {
  const me = gs[myKey];
  const basics = me.hand.filter(c => c.def.supertype === "Pokémon" && c.def.stage === "basic");

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center w-full max-w-sm">
        <div className="w-12 h-12 rounded-xl bg-secondary mx-auto mb-4 flex items-center justify-center"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="3" width="12" height="16" rx="2"/><rect x="8" y="7" width="12" height="16" rx="2" opacity="0.4"/></svg></div>
        <h2 className="font-display text-xl font-bold mb-1">Game Setup</h2>
        <p className="text-muted-foreground text-sm font-body mb-6">
          {gs.activePlayer === myKey ? "You go first!" : `${gs[gs.activePlayer].name} goes first.`}
        </p>

        <div className="bg-card border border-border rounded-2xl p-4 mb-6 text-left">
          <p className="font-display text-xs font-bold text-muted-foreground uppercase mb-3">Your Opening Hand</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {me.hand.map(c => (
              <div key={c.instanceId} className={`text-xs px-2 py-1 rounded-lg font-body
                ${c.def.supertype === "Pokémon" ? "bg-blue-900/40 text-blue-300" :
                  c.def.supertype === "Trainer" ? "bg-emerald-900/40 text-emerald-300" :
                  "bg-yellow-900/40 text-yellow-300"}`}>
                {c.def.name}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground font-body">
            {basics.length} Basic Pokémon · {me.mulligans > 0 ? `${me.mulligans} mulligan(s)` : "No mulligans"}
          </p>
        </div>

        <Button onClick={onReady} className="w-full font-display h-12 text-base">
          Start Battle
        </Button>
      </motion.div>
    </div>
  );
}