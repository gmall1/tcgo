import React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Loader2, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/localDb";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";

const TIER_RANKS = {
  bronze:   { label: "Bronze",   abbr: "BR", color: "text-orange-600",  bg: "bg-orange-600/10" },
  silver:   { label: "Silver",   abbr: "SV", color: "text-slate-400",   bg: "bg-slate-400/10" },
  gold:     { label: "Gold",     abbr: "GD", color: "text-yellow-500",  bg: "bg-yellow-500/10" },
  platinum: { label: "Platinum", abbr: "PT", color: "text-cyan-400",    bg: "bg-cyan-400/10" },
  diamond:  { label: "Diamond",  abbr: "DM", color: "text-blue-400",    bg: "bg-blue-400/10" },
  master:   { label: "Master",   abbr: "MS", color: "text-purple-400",  bg: "bg-purple-400/10" },
};

export default function Leaderboard() {
  const { data: ranks = [], isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => db.entities.PlayerRank.list("-elo_rating", 100),
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-8">
        <PageHeader
          title="LEADERBOARD"
          subtitle={`${ranks.length} players ranked`}
        />

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : ranks.length === 0 ? (
          <div className="text-center py-20">
            <Crown className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="font-display text-lg font-bold mb-2">No ranked matches yet</p>
            <p className="text-muted-foreground font-body">Play ranked battles to climb the ladder.</p>
          </div>
        ) : (
          <div className="mt-5 space-y-2">
            {ranks.map((entry, idx) => {
              const tier = TIER_RANKS[entry.rank_tier] || TIER_RANKS.bronze;
              const isTop3 = idx < 3;

              return (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.2) }}
                >
                  <div className={`rounded-2xl border p-4 flex items-center gap-4 ${
                    isTop3
                      ? "border-primary/50 bg-primary/5"
                      : "border-border bg-card"
                  }`}>
                    {/* Rank */}
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center font-display text-xl font-black">
                      {isTop3 ? (
                        <Trophy className={`w-6 h-6 ${
                          idx === 0 ? "text-yellow-500" : idx === 1 ? "text-slate-400" : "text-orange-600"
                        }`} />
                      ) : (
                        <span className="text-muted-foreground">#{idx + 1}</span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-display font-bold text-base">{entry.username || "Trainer"}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`font-display text-xs font-bold ${tier.bg} ${tier.color}`}>
                          {tier.label}
                        </Badge>
                        <span className="text-[11px] font-body text-muted-foreground">
                          {entry.wins || 0}W-{entry.losses || 0}L
                        </span>
                      </div>
                    </div>

                    {/* ELO */}
                    <div className="flex-shrink-0 text-right">
                      <p className="font-display text-lg font-black">{entry.elo_rating || 1200}</p>
                      <p className="text-[10px] font-body text-muted-foreground uppercase tracking-wider">ELO</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
