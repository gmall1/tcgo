// =============================================================
// AttackPromptModal — UI for the engine's prompt-driven attacks.
// Three flavours, mapped to `attack.prompt.kind`:
//   • birthday      — Birthday Pikachu's "is today your birthday?" prompt
//   • height-guess  — Unown ANSWER's height-guessing minigame
//   • rps           — Rock-Paper-Scissors Hitmontop's choose-a-throw card
// The user's answer is passed back to performAttack as `promptAnswer`.
// =============================================================

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cake, Ruler, Hand, Scissors, Square as SquareIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

function PromptShell({ title, subtitle, onCancel, children }) {
  return (
    <AnimatePresence>
      <motion.div
        key="prompt-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6"
      >
        <motion.div
          initial={{ scale: 0.95, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 12, opacity: 0 }}
          className="w-full max-w-md rounded-2xl border border-primary/40 bg-card shadow-2xl"
        >
          <div className="p-5 border-b border-border space-y-1">
            <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
            {subtitle && (
              <p className="text-sm font-body text-muted-foreground leading-snug">{subtitle}</p>
            )}
          </div>
          <div className="p-5 space-y-4">{children}</div>
          <div className="px-5 pb-4">
            <Button variant="ghost" size="sm" onClick={onCancel} className="font-body text-muted-foreground">
              Cancel attack
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function BirthdayPrompt({ onAnswer, onCancel, attackName }) {
  return (
    <PromptShell
      title={attackName || "Birthday Surprise"}
      subtitle="Is today your birthday? (Honor system — we trust you.)"
      onCancel={onCancel}
    >
      <div className="flex items-center justify-center gap-3 text-primary">
        <Cake className="w-6 h-6" />
        <span className="font-body text-sm">+30 damage if it's your birthday.</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Button onClick={() => onAnswer({ isBirthday: true })} className="font-body">
          Yes — it's my birthday
        </Button>
        <Button variant="outline" onClick={() => onAnswer({ isBirthday: false })} className="font-body">
          No — not today
        </Button>
      </div>
    </PromptShell>
  );
}

function HeightGuessPrompt({ onAnswer, onCancel, attackName, defenderName, tiers }) {
  const [val, setVal] = useState("1.0");
  const tierSummary = useMemo(() => {
    if (!Array.isArray(tiers) || tiers.length === 0) return null;
    return tiers
      .filter((t) => Number.isFinite(Number(t.within)))
      .map((t) => `±${t.within}m → ${t.damage} dmg`)
      .join(" · ");
  }, [tiers]);
  return (
    <PromptShell
      title={attackName || "Guess the Height"}
      subtitle={`How tall is ${defenderName} in metres? Closer guesses do more damage.`}
      onCancel={onCancel}
    >
      <div className="flex items-center gap-3 text-primary">
        <Ruler className="w-6 h-6" />
        {tierSummary && <span className="font-body text-xs text-muted-foreground">{tierSummary}</span>}
      </div>
      <input
        type="number"
        step="0.1"
        min="0"
        max="20"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground font-body text-lg text-center focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <Button onClick={() => onAnswer({ guess: Number(val) })} className="w-full font-body">
        Lock in {val || "?"} m
      </Button>
    </PromptShell>
  );
}

function RpsPrompt({ onAnswer, onCancel, attackName }) {
  const choices = [
    { id: "rock", label: "Rock", icon: Hand },
    { id: "paper", label: "Paper", icon: SquareIcon },
    { id: "scissors", label: "Scissors", icon: Scissors },
  ];
  return (
    <PromptShell
      title={attackName || "Throwdown"}
      subtitle="Choose Rock, Paper, or Scissors. The opponent counter-throws at random."
      onCancel={onCancel}
    >
      <div className="grid grid-cols-3 gap-3">
        {choices.map((c) => (
          <button
            key={c.id}
            onClick={() => onAnswer({ choice: c.id })}
            className="rounded-xl border border-border bg-background p-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/10 transition-colors"
          >
            <c.icon className="w-7 h-7 text-primary" />
            <span className="font-body text-sm font-semibold">{c.label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground font-body text-center">
        Win → 50 dmg · Tie → 20 dmg · Lose → 20 self-damage
      </p>
    </PromptShell>
  );
}

export default function AttackPromptModal({ pending, onAnswer, onCancel }) {
  if (!pending?.prompt) return null;
  const { prompt, attackName, defenderName } = pending;
  if (prompt.kind === "birthday") {
    return <BirthdayPrompt attackName={attackName} onAnswer={onAnswer} onCancel={onCancel} />;
  }
  if (prompt.kind === "height-guess") {
    return (
      <HeightGuessPrompt
        attackName={attackName}
        defenderName={defenderName}
        tiers={prompt.tiers}
        onAnswer={onAnswer}
        onCancel={onCancel}
      />
    );
  }
  if (prompt.kind === "rps") {
    return <RpsPrompt attackName={attackName} onAnswer={onAnswer} onCancel={onCancel} />;
  }
  return null;
}
