import React from "react";
import { motion } from "framer-motion";
import { TypeIcon, TYPE_META } from "@/lib/typeIcons";

export default function BattleHand({ hand, onCardClick, selectedUid, isMyTurn }) {
  if (!hand || hand.length === 0) return (
    <div className="px-3 py-2 text-center text-muted-foreground text-xs font-body">Hand is empty</div>
  );

  return (
    <div className="px-3 py-2">
      <div className="flex gap-1.5 overflow-x-auto pb-1 justify-start">
        {hand.map(battleCard => (
          <HandCard
            key={battleCard.uid}
            battleCard={battleCard}
            onClick={() => isMyTurn && onCardClick(battleCard)}
            selected={selectedUid === battleCard.uid}
            disabled={!isMyTurn}
          />
        ))}
      </div>
    </div>
  );
}

function HandCard({ battleCard, onClick, selected, disabled }) {
  const { card } = battleCard;
  const typeKey = (card.types?.[0] || card.energy_type || "colorless").toLowerCase();
  const meta = TYPE_META[typeKey] || TYPE_META.colorless;
  const imgUrl = card.image ? `${card.image}/low.webp` : (card.imageSmall || card.image_small || null);

  const superLabel = card.supertype === "Pokémon" || card.category === "Pokemon"
    ? "PKM"
    : card.supertype === "Trainer" || card.category === "Trainer"
    ? "TRN"
    : "NRG";

  return (
    <motion.div
      whileHover={!disabled ? { y: -8, scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.97 } : {}}
      onClick={onClick}
      className={`flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden relative cursor-pointer
        ${selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
        ${disabled ? "opacity-60" : ""}`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${meta.bg}`} />
      {imgUrl ? (
        <img src={imgUrl} alt={card.name} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="relative h-full flex flex-col items-center justify-between p-1.5">
          <span className="text-white text-[9px] font-body font-bold leading-tight text-center line-clamp-2">{card.name}</span>
          <TypeIcon type={typeKey} size={24} />
          <span className="text-white/60 text-[8px] font-display tracking-wider">{superLabel}</span>
        </div>
      )}
    </motion.div>
  );
}
