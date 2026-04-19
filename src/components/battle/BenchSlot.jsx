import React from "react";
import { motion } from "framer-motion";
import { TypeIcon, StatusBadge, TYPE_META } from "@/lib/typeIcons";

export default function BenchSlot({ pokemon, index, onClick, isMyTurn, isEmpty }) {
  if (isEmpty || !pokemon) {
    return (
      <div className="w-14 h-20 rounded-xl border border-dashed border-border/40 flex items-center justify-center opacity-30">
        <span className="text-[9px] text-muted-foreground font-body">{index + 1}</span>
      </div>
    );
  }

  const typeKey = (
    pokemon.def?.types?.[0] ||
    pokemon.def?.energy_type ||
    pokemon.card?.types?.[0] ||
    "colorless"
  ).toLowerCase();
  const meta = TYPE_META[typeKey] || TYPE_META.colorless;
  const hp = pokemon.def?.hp ? Number(pokemon.def.hp) : (pokemon.hp || 100);
  const damage = pokemon.damage || 0;
  const hpPct = Math.max(0, Math.min(100, ((hp - damage) / hp) * 100));
  const energyCount = (pokemon.energyAttached || pokemon.energies || []).length;
  const imgUrl = pokemon.def?.imageSmall || pokemon.def?.image_small || pokemon.card?.imageSmall || null;

  return (
    <motion.div
      whileHover={isMyTurn && onClick ? { scale: 1.08 } : { scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className={`w-14 h-20 rounded-xl overflow-hidden relative cursor-pointer flex-shrink-0
        ${isMyTurn && onClick ? "ring-1 ring-primary/40" : ""}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.bg}`} />

      <div className="relative h-full flex flex-col">
        {imgUrl ? (
          <img src={imgUrl} alt={pokemon.def?.name || pokemon.card?.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <TypeIcon type={typeKey} size={22} />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
          <div className="h-1 bg-black/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${hpPct > 50 ? "bg-green-400" : hpPct > 20 ? "bg-yellow-400" : "bg-red-400"}`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          {energyCount > 0 && (
            <div className="text-center text-[8px] text-white/60 mt-0.5 font-display">{energyCount}E</div>
          )}
        </div>

        {pokemon.specialCondition && (
          <div className="absolute top-0.5 left-0.5">
            <StatusBadge condition={pokemon.specialCondition} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
