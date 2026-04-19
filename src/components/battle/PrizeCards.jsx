import React from "react";

export default function PrizeCards({ count, isOpponent }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-body text-muted-foreground">Prizes:</span>
      <div className="flex gap-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}
            className={`w-4 h-5 rounded-sm border ${i < count
              ? isOpponent ? "bg-red-900/60 border-red-700/50" : "bg-blue-900/60 border-blue-700/50"
              : "bg-muted/30 border-border/30"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] font-body text-muted-foreground">{count}/6</span>
    </div>
  );
}