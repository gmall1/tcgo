import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";

export default function PlayerHand({ hand, isMyTurn, onCardClick, selectedCard }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-card border-t border-border">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-body text-muted-foreground hover:text-foreground transition-colors">
        <span>Hand ({hand.length} cards) {isMyTurn ? "— tap to play" : ""}</span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 flex gap-2 overflow-x-auto">
              {hand.map((card) => (
                <HandCard
                  key={card.instanceId}
                  card={card}
                  isSelected={selectedCard?.instanceId === card.instanceId}
                  isMyTurn={isMyTurn}
                  onClick={() => onCardClick(card)}
                />
              ))}
              {hand.length === 0 && (
                <p className="text-muted-foreground text-xs font-body py-4">No cards in hand</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HandCard({ card, isSelected, isMyTurn, onClick }) {
  const def = card.def;
  const typeColors = {
    "Pokémon": "from-blue-700 to-blue-900",
    "Trainer": "from-emerald-700 to-teal-900",
    "Energy": "from-yellow-600 to-amber-800",
  };
  const bg = typeColors[def.supertype] || "from-gray-600 to-gray-800";

  return (
    <motion.div
      whileHover={isMyTurn ? { scale: 1.05, y: -4 } : {}}
      whileTap={isMyTurn ? { scale: 0.97 } : {}}
      onClick={isMyTurn ? onClick : undefined}
      className={`flex-shrink-0 w-20 rounded-xl overflow-hidden cursor-pointer
        ${isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""}
        ${isMyTurn ? "opacity-100" : "opacity-60"}`}
    >
      {def.imageSmall ? (
        <img src={def.imageSmall} alt={def.name} className="w-full h-28 object-contain bg-gradient-to-b from-gray-800 to-gray-900" />
      ) : (
        <div className={`w-full h-28 bg-gradient-to-b ${bg} flex flex-col items-center justify-center p-2`}>
          <span className="text-2xl mb-1">
            {def.supertype === "Pokémon" ? "PKM" : def.supertype === "Trainer" ? "TRN" : "NRG"}
          </span>
          <p className="text-white text-[9px] font-body text-center leading-tight">{def.name}</p>
          {def.hp && <p className="text-white/60 text-[8px] mt-0.5">{def.hp} HP</p>}
        </div>
      )}
      <div className="bg-black/40 px-1 py-0.5 text-center">
        <p className="text-white/70 text-[8px] font-body truncate">{def.name}</p>
      </div>
    </motion.div>
  );
}