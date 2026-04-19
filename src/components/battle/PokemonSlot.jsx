import React from "react";
import { motion } from "framer-motion";
import { TypeIcon, StatusBadge, TYPE_META } from "@/lib/typeIcons";

export default function PokemonSlot({ pokemon, label, onClick, selected, size = "md" }) {
  const sizeClasses = { sm: "w-14 h-20", md: "w-20 h-28", lg: "w-24 h-32" };

  if (!pokemon) {
    return (
      <div className={`${sizeClasses[size]} rounded-xl border-2 border-dashed border-border flex items-center justify-center opacity-40`}>
        <span className="text-xs text-muted-foreground font-body">{label}</span>
      </div>
    );
  }

  const typeKey = (pokemon.card?.types?.[0] || pokemon.def?.types?.[0] || pokemon.card?.energy_type || "colorless").toLowerCase();
  const meta = TYPE_META[typeKey] || TYPE_META.colorless;
  const hp = pokemon.hp || pokemon.def?.hp || 100;
  const currentHp = pokemon.currentHp ?? (hp - (pokemon.damage || 0));
  const hpPercent = hp > 0 ? Math.max(0, (currentHp / hp) * 100) : 0;
  const imgUrl = pokemon.card?.image
    ? `${pokemon.card.image}/low.webp`
    : (pokemon.def?.imageSmall || pokemon.def?.image_small || null);

  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`${sizeClasses[size]} rounded-xl overflow-hidden relative cursor-pointer flex-shrink-0
        ${selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.bg}`} />

      <div className="relative h-full flex flex-col">
        {imgUrl ? (
          <img src={imgUrl} alt={pokemon.card?.name || pokemon.def?.name} className="w-full h-full object-cover" />
        ) : (
          <div className="flex-1 flex items-center justify-center opacity-70">
            <TypeIcon type={typeKey} size={size === "sm" ? 20 : size === "lg" ? 32 : 26} />
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-white text-[8px] font-body font-bold truncate max-w-[70%]">
              {pokemon.card?.name || pokemon.def?.name}
            </span>
            <span className="text-white text-[8px] font-display">{Math.round(currentHp)}</span>
          </div>
          <div className="h-1 bg-black/40 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${hpPercent > 50 ? "bg-green-400" : hpPercent > 20 ? "bg-yellow-400" : "bg-red-400"}`}
              style={{ width: `${hpPercent}%` }}
            />
          </div>
        </div>

        {pokemon.conditions?.length > 0 && (
          <div className="absolute top-1 left-1 flex gap-0.5 flex-wrap">
            {pokemon.conditions.map(c => <StatusBadge key={c} condition={c} />)}
          </div>
        )}
        {pokemon.specialCondition && (
          <div className="absolute top-1 left-1">
            <StatusBadge condition={pokemon.specialCondition} />
          </div>
        )}

        {(pokemon.energies?.length > 0 || pokemon.energyAttached?.length > 0) && (
          <div className="absolute top-1 right-1 bg-black/50 rounded-full w-4 h-4 flex items-center justify-center">
            <span className="text-[9px] text-yellow-300 font-bold font-display">
              {(pokemon.energies || pokemon.energyAttached || []).length}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
