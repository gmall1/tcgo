import React from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Trophy, RotateCcw, Home } from "lucide-react";

export default function GameOverScreen({ won, gs, myKey, onRematch, onLeave }) {
  const me = gs?.[myKey];
  const opp = gs?.[myKey === "player1" ? "player2" : "player1"];
  const prizesTaken = 6 - (me?.prizeCards?.length || 0);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.4 }}
        className="text-center w-full max-w-sm"
      >
        <motion.div
          initial={{ rotate: -10 }} animate={{ rotate: [10, -10, 5, -5, 0] }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-7xl mb-5"
        >
          {won ? "WIN" : "KO"}
        </motion.div>

        <h1 className="font-display text-3xl font-black mb-2">
          {won ? "VICTORY!" : "DEFEATED"}
        </h1>
        <p className="text-muted-foreground font-body mb-8">
          {won ? `You defeated ${opp?.name}!` : `${opp?.name} won this time.`}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <StatBox label="Turns" value={gs?.turn || 0} />
          <StatBox label="Prizes Taken" value={prizesTaken} />
          <StatBox label="Cards Left" value={me?.deck?.length || 0} />
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" onClick={onLeave} className="flex-1 gap-2 font-body">
            <Home className="w-4 h-4" /> Home
          </Button>
          <Button onClick={onRematch} className="flex-1 gap-2 font-body">
            <RotateCcw className="w-4 h-4" /> Rematch
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3 text-center">
      <p className="font-display font-bold text-xl">{value}</p>
      <p className="text-muted-foreground text-xs font-body mt-0.5">{label}</p>
    </div>
  );
}