import { TypeIcon } from "@/lib/typeIcons";
import React from "react";
import { motion } from "framer-motion";
import { TYPE_COLORS } from "@/lib/cardData";

export default function CardDisplay({ card, size = "md", onClick, selected = false }) {
  const typeInfo = TYPE_COLORS[card.energy_type] || TYPE_COLORS.colorless;
  
  const sizeClasses = {
    sm: "w-28 min-h-[160px]",
    md: "w-36 min-h-[210px]",
    lg: "w-48 min-h-[280px]",
  };

  const rarityGlow = {
    ultra_rare: "shadow-[0_0_20px_rgba(168,85,247,0.4)]",
    secret_rare: "shadow-[0_0_20px_rgba(234,179,8,0.4)]",
    full_art: "shadow-[0_0_20px_rgba(236,72,153,0.4)]",
    holo_rare: "shadow-[0_0_15px_rgba(96,165,250,0.3)]",
    rare: "shadow-[0_0_10px_rgba(148,163,184,0.2)]",
    uncommon: "",
    common: "",
  };

  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick?.(card)}
      className={`${sizeClasses[size]} rounded-xl overflow-hidden cursor-pointer relative flex-shrink-0
        ${rarityGlow[card.rarity] || ""} ${selected ? "ring-2 ring-accent ring-offset-2 ring-offset-background" : ""}`}
    >
      {/* Card Background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${card.card_type === "energy" ? typeInfo.bg : card.card_type === "trainer" ? "from-emerald-700 to-teal-900" : typeInfo.bg} opacity-90`} />
      
      {/* Card Content */}
      <div className="relative h-full flex flex-col p-3">
        {/* Header */}
        <div className="flex justify-between items-start mb-1">
          <span className="text-white font-body font-bold text-xs leading-tight flex-1 mr-1 truncate">{card.name}</span>
          {card.hp && <span className="text-white/80 font-display text-[10px] font-bold whitespace-nowrap">{card.hp}HP</span>}
        </div>

        {/* Type Icon / Art Area */}
        <div className="flex-1 flex items-center justify-center my-2">
          <div className="text-4xl opacity-60">
            <TypeIcon type={card.energy_type || "colorless"} size={28} />
          </div>
        </div>

        {/* Card Type Badge */}
        <div className="flex items-center gap-1 mb-1">
          <span className="bg-black/30 text-white/80 text-[9px] font-body px-1.5 py-0.5 rounded-full capitalize">
            {card.card_type}
          </span>
          {card.stage && (
            <span className="bg-white/15 text-white/70 text-[9px] font-body px-1.5 py-0.5 rounded-full uppercase">
              {card.stage}
            </span>
          )}
        </div>

        {/* Attack Preview */}
        {card.attack1_name && (
          <div className="bg-black/20 rounded-lg p-1.5">
            <div className="flex justify-between items-center">
              <span className="text-white/90 text-[10px] font-body font-medium truncate">{card.attack1_name}</span>
              {card.attack1_damage > 0 && <span className="text-white font-display text-xs font-bold ml-1">{card.attack1_damage}</span>}
            </div>
          </div>
        )}

        {/* Rarity indicator */}
        <div className="flex justify-end mt-1">
          <span className="text-[9px] text-white/40 font-body capitalize">{card.rarity?.replace(/_/g, " ")}</span>
        </div>
      </div>

      {/* Selected overlay */}
      {selected && (
        <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
            <span className="text-white text-lg">✓</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}