import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Flame, Unlock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import {
  BATTLE_PASS_REWARDS,
  createBattlePass,
  getSeasonProgress,
  getAvailableReward,
  claimReward,
  addBattlePassExperience,
} from "@/lib/battlePassSystem";

export default function BattlePass() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pass, setPass] = useState(() => {
    const saved = localStorage.getItem("user-battle-pass");
    return saved ? JSON.parse(saved) : createBattlePass("free");
  });

  const progress = useMemo(() => getSeasonProgress(pass), [pass]);

  const savePass = (updated) => {
    localStorage.setItem("user-battle-pass", JSON.stringify(updated));
    setPass(updated);
  };

  // Mock: add XP from battle
  const addExp = (amount = 100) => {
    const updated = addBattlePassExperience({ ...pass }, amount);
    savePass(updated);
    toast({ title: "Battle XP +100", description: "Progress towards next level" });
  };

  const claimAvailableReward = () => {
    const reward = getAvailableReward(pass);
    if (!reward) return;

    const updated = claimReward({ ...pass }, reward.level);
    savePass(updated);
    toast({
      title: `Level ${reward.level} claimed!`,
      description: reward.description,
    });
  };

  const expPercentage = (pass.experience / 1000) * 100;
  const availableReward = getAvailableReward(pass);
  const rewardTable = pass.isPremium ? BATTLE_PASS_REWARDS.premium : BATTLE_PASS_REWARDS.free;

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/collection")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <p className="font-display font-bold text-base">Battle Pass</p>
          <div />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        <PageHeader
          title="SEASONAL BATTLE PASS"
          subtitle={`${progress.daysRemaining} days remaining`}
        />

        {/* Season progress */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-display text-2xl font-bold">Level {pass.level}</p>
              <p className="text-sm font-body text-muted-foreground mt-1">
                {pass.isPremium ? "Premium" : "Free"} • {pass.level}/{pass.maxLevel}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-1">
                Season ends in
              </p>
              <p className="font-display text-xl font-bold">{progress.daysRemaining} days</p>
            </div>
          </div>

          {/* XP bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-body text-muted-foreground">Experience</span>
              <span className="text-xs font-display font-bold">
                {pass.experience}/1000
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${expPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Level up preview */}
          {availableReward ? (
            <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 space-y-2">
              <p className="text-xs font-body font-semibold text-primary uppercase tracking-widest">
                Reward ready!
              </p>
              <p className="text-sm font-body text-foreground">{availableReward.description}</p>
              <Button
                onClick={claimAvailableReward}
                className="w-full font-body gap-2"
                size="sm"
              >
                <Unlock className="w-3.5 h-3.5" /> Claim reward
              </Button>
            </div>
          ) : (
            <p className="text-xs font-body text-muted-foreground text-center py-2">
              Complete battles to earn experience
            </p>
          )}

          {/* Mock add XP button */}
          <Button
            onClick={() => addExp(100)}
            variant="outline"
            className="w-full font-body gap-2"
            size="sm"
          >
            <Flame className="w-3.5 h-3.5" /> Simulate battle victory (+100 XP)
          </Button>
        </motion.div>

        {/* Tier comparison */}
        {!pass.isPremium && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3"
          >
            <div className="flex items-start gap-3">
              <Zap className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-display font-bold mb-1">Upgrade to Premium?</p>
                <p className="text-sm font-body text-muted-foreground mb-3">
                  Get up to level 100, unlock exclusive rewards, and earn more tokens & cards every season.
                </p>
                <Button
                  onClick={() => navigate("/premium")}
                  className="font-body gap-2"
                  size="sm"
                >
                  View premium tiers
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Rewards grid */}
        <div>
          <p className="font-display font-bold text-lg mb-4">Season rewards</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(rewardTable).map(([level, reward]) => {
              const isUnlocked = parseInt(level) <= pass.level;
              const isClaimed = pass.claimedRewards.includes(parseInt(level));

              return (
                <motion.button
                  key={level}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={isUnlocked ? { scale: 1.05 } : {}}
                  onClick={() => {
                    if (isUnlocked && !isClaimed && parseInt(level) === pass.level) {
                      claimAvailableReward();
                    }
                  }}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    isClaimed
                      ? "border-primary/30 bg-primary/5"
                      : isUnlocked
                      ? "border-primary bg-primary/10 hover:bg-primary/20"
                      : "border-border bg-background opacity-50"
                  }`}
                >
                  <p className="text-xs font-display font-bold text-muted-foreground uppercase tracking-widest mb-1">
                    Level {level}
                  </p>
                  <p className="text-[11px] font-body text-foreground line-clamp-2">
                    {reward.description}
                  </p>
                  {isClaimed && (
                    <Badge variant="outline" className="mt-2 text-[10px] font-body">
                      Claimed
                    </Badge>
                  )}
                  {isUnlocked && !isClaimed && (
                    <Badge variant="secondary" className="mt-2 text-[10px] font-body">
                      Ready
                    </Badge>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Info */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="font-display font-bold text-base">How it works</p>
          <ul className="space-y-2 text-sm font-body text-muted-foreground">
            <li>✓ Win battles to earn experience</li>
            <li>✓ Reach new levels to unlock rewards</li>
            <li>✓ Claim tokens, cards, and exclusive items</li>
            <li>✓ Premium pass has more rewards and higher level cap (100)</li>
          </ul>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
