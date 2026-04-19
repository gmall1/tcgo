import React from "react";

export default function PrizePile({ count, isOpponent }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] font-body text-muted-foreground">Prizes</span>
      <div className="flex flex-col gap-0.5">
        {Array(6).fill(null).map((_, i) => (
          <div
            key={i}
            className={`w-8 h-2.5 rounded-sm transition-all ${
              i < count
                ? isOpponent ? "bg-red-500/70" : "bg-blue-500/70"
                : "bg-secondary/30"
            }`}
          />
        ))}
      </div>
    </div>
  );
}