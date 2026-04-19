import { TypeIcon } from "@/lib/typeIcons";
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { TYPE_COLORS } from "@/lib/cardData";
import { Button } from "@/components/ui/button";

export default function CardDetailModal({ card, onClose, onAddToDeck }) {
  const typeInfo = TYPE_COLORS[card.energy_type] || TYPE_COLORS.colorless;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-5"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, y: 30 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 30 }}
          className="bg-card rounded-2xl border border-border w-full max-w-sm overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Card Art Area */}
          <div className={`bg-gradient-to-br ${card.card_type === "energy" ? typeInfo.bg : card.card_type === "trainer" ? "from-emerald-700 to-teal-900" : typeInfo.bg} p-8 text-center relative`}>
            <button onClick={onClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 flex items-center justify-center">
              <X className="w-4 h-4 text-white" />
            </button>
            <div className="text-6xl mb-3">
              <TypeIcon type={card.energy_type || "colorless"} size={32} />
            </div>
            <h2 className="font-display text-xl font-bold text-white">{card.name}</h2>
            {card.hp && <p className="text-white/70 font-display text-sm mt-1">{card.hp} HP</p>}
          </div>

          {/* Card Details */}
          <div className="p-5 space-y-4">
            {/* Tags */}
            <div className="flex flex-wrap gap-2">
              <span className="bg-secondary text-secondary-foreground text-xs font-body px-3 py-1 rounded-full capitalize">
                {card.card_type}
              </span>
              {card.stage && (
                <span className="bg-secondary text-secondary-foreground text-xs font-body px-3 py-1 rounded-full uppercase">
                  {card.stage}
                </span>
              )}
              {card.rarity && (
                <span className="bg-primary/10 text-primary text-xs font-body px-3 py-1 rounded-full capitalize">
                  {card.rarity.replace(/_/g, " ")}
                </span>
              )}
              {card.set_name && (
                <span className="bg-muted text-muted-foreground text-xs font-body px-3 py-1 rounded-full">
                  {card.set_name}
                </span>
              )}
            </div>

            {/* Attacks */}
            {card.attack1_name && (
              <div className="space-y-2">
                <h3 className="font-display text-xs font-bold tracking-wider text-muted-foreground uppercase">Attacks</h3>
                <div className="bg-secondary rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <span className="font-body font-semibold text-sm">{card.attack1_name}</span>
                    <span className="font-display font-bold text-primary">{card.attack1_damage || "-"}</span>
                  </div>
                  <span className="text-muted-foreground text-xs font-body">Cost: {card.attack1_cost} energy</span>
                </div>
                {card.attack2_name && (
                  <div className="bg-secondary rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-body font-semibold text-sm">{card.attack2_name}</span>
                      <span className="font-display font-bold text-primary">{card.attack2_damage || "-"}</span>
                    </div>
                    <span className="text-muted-foreground text-xs font-body">Cost: {card.attack2_cost} energy</span>
                  </div>
                )}
              </div>
            )}

            {/* Trainer/Energy Description */}
            {card.description && (