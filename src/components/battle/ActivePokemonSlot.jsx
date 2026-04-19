import React from "react";
import { motion } from "framer-motion";
import { TypeIcon, StatusBadge, TYPE_META } from "@/lib/typeIcons";
import { SPECIAL_CONDITIONS } from "@/lib/gameConstants";

export default function ActivePokemonSlot({ pokemon, isOpponent, label, isMyTurn, actionMode, onClick }) {
  if (!pokemon) {
    return (
      <div className="w-36 h-28 rounded-2xl border-2 border-dashed border-border/50 flex items-center justify-center">
        <span className="text-muted-foreground text-xs font-body">No Active</span>
      </div>
    );
  }

  const typeKey = (pokemon.def.types?.[0] || pokemon.def.energy_type || "colorless").toLowerCase();
  const meta = TYPE_META[typeKey] || TYPE_META.colorless;
  const hp = pokemon.def.hp ? Number(pokemon.def.hp) : 100;
  const hpPct = Math.max(0, Math.min(100, ((hp - pokemon.damage) / hp) * 100));
  const energyCount = pokemon.energyAttached?.length || 0;
  const imgUrl = pokemon.def.imageLarge || pokemon.def.image_large || pokemon.def.imageSmall || pokemon.def.image_small;

  return (
    <motion.div
      whileHover={onClick ? { scale: 1.03 } : {}}
      onClick={onClick}
      className={`w-44 rounded-2xl overflow-hidden border-2 cursor-pointer
        ${isOpponent ? "border-red-900/50" : "border-blue-900/50"}
        ${onClick && isMyTurn ? "hover:border-primary/50" : ""}
        bg-gradient-to-b from-card to-secondary`}
    >
      <div className={`px-3 py-1.5 bg-gradient-to-r ${meta.bg} flex items-center justify-between`}>
        <span className="text-white font-body text-xs font-bold truncate">{pokemon.def.name}</span>
        <div className="flex items-center gap-1">
          {pokemon.def.hp && (
            <span className="text-white/80 text-[10px] font-display">
              {hp - pokemon.damage}/{hp}
            </span>
          )}
          {pokemon.specialCondition && (
            <StatusBadge condition={pokemon.specialCondition} />
          )}
        </div>
      </div>

      <div className="relative px-3 py-2">
        {imgUrl ? (
          <img src={imgUrl} alt={pokemon.def.name} className="w-full h-16 object-contain" />
        ) : (
          <div className="w-full h-16 flex items-center justify-center opacity-60">
            <TypeIcon type={typeKey} size={40} />
          </div>
        )}

        <div className="mt-1">
          <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full transition-colors ${hpPct > 50 ? "bg-green-400" : hpPct > 20 ? "bg-yellow-400" : "bg-red-400"}`}
              animate={{ width: `${hpPct}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {energyCount > 0 && (
          <div className="flex gap-0.5 mt-1 flex-wrap">
            {pokemon.energyAttached.slice(0, 6).map((e, i) => {
              const eKey = (e.def?.types?.[0] || e.def?.energy_type || "colorless").toLowerCase();
              return (
                <span key={i} className="w-4 h-4 rounded-full bg-black/40 flex items-center justify-center">
                  <TypeIcon type={eKey} size={10} />
                </span>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
