import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";

export default function BattleLog({ log, onClose }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [log]);

  return (
    <motion.div
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col"
    >
      <div className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
        <h2 className="font-display font-bold text-sm">Battle Log</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary">
          <X className="w-5 h-5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {log.map((entry, i) => (
          <p key={i} className={`text-sm font-body leading-relaxed ${
            entry.startsWith("---") ? "text-muted-foreground text-xs pt-2 font-semibold" :
            entry.includes("Knocked Out") ? "text-red-400 font-semibold" :
            entry.includes("Prize") ? "text-yellow-400" :
            entry.includes("wins") ? "text-primary font-bold text-base" :
            "text-foreground/80"
          }`}>{entry}</p>
        ))}
        <div ref={bottomRef} />
      </div>
    </motion.div>
  );
}