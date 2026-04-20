import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Heart, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { PREMIUM_TIERS, getUserPremiumStatus, getRemainingDays } from "@/lib/premiumTier";

export default function Premium() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const premiumStatus = getUserPremiumStatus();
  const daysRemaining = getRemainingDays();

  const handleDonation = (tier) => {
    // In production, this would open a donation modal or external link
    const donationUrl = {
      supporter: "https://donate.example.com/supporter?amount=5",
      champion: "https://donate.example.com/champion?amount=15",
    };

    toast({
      title: "Coming soon",
      description: `${PREMIUM_TIERS[tier].name} donation link will be available soon.`,
    });

    // Open donation link (replace with real URL)
    // window.open(donationUrl[tier], "_blank");
  };

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
          <p className="font-display font-bold text-base">Premium tiers</p>
          <div />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        <PageHeader
          title="SUPPORT THE GAME"
          subtitle="Your donation helps fund development. Get exclusive perks in return."
        />

        {/* Current status */}
        {premiumStatus.tier !== "free" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 border-primary bg-primary/5 p-5"
          >
            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-display font-bold text-lg mb-1">
                  Thank you for supporting us!
                </p>
                <p className="text-sm font-body text-muted-foreground">
                  You're on the {PREMIUM_TIERS[premiumStatus.tier].name} tier. 
                  {daysRemaining > 0 && ` Expires in ${daysRemaining} days.`}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Tier cards */}
        <div className="space-y-4">
          {/* Free tier */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-5 space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-display text-xl font-bold">{PREMIUM_TIERS.free.name}</p>
                <p className="text-sm font-body text-muted-foreground mt-1">
                  {PREMIUM_TIERS.free.description}
                </p>
              </div>
              {premiumStatus.tier === "free" && (
                <Badge variant="secondary" className="font-body">
                  Current
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {PREMIUM_TIERS.free.perks.map((perk, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm font-body text-muted-foreground">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  {perk}
                </div>
              ))}
            </div>

            <p className="text-xs font-body text-muted-foreground">No cost — play for free forever</p>
          </motion.div>

          {/* Supporter tier */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className={`rounded-2xl border-2 p-5 space-y-4 transition-all ${
              premiumStatus.tier === "supporter"
                ? "border-primary bg-primary/5"
                : "border-border bg-card hover:border-primary/50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-5 h-5 text-yellow-500" />
                  <p className="font-display text-xl font-bold">{PREMIUM_TIERS.supporter.name}</p>
                </div>
                <p className="text-sm font-body text-muted-foreground">
                  {PREMIUM_TIERS.supporter.description}
                </p>
              </div>
              {premiumStatus.tier === "supporter" && (
                <Badge variant="secondary" className="font-body">
                  Active
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {PREMIUM_TIERS.supporter.perks.map((perk, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm font-body">
                  <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  {perk}
                </div>
              ))}
            </div>

            <div className="bg-background/50 rounded-lg p-3">
              <p className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2">
                Monthly rewards
              </p>
              <div className="flex gap-3 text-sm font-body">
                <div>
                  <p className="font-semibold">500 Tokens</p>
                </div>
                <div>
                  <p className="font-semibold">2 Packs</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-2xl font-display font-black">
                $5<span className="text-sm font-body text-muted-foreground">/month</span>
              </p>
              <Button
                onClick={() => handleDonation("supporter")}
                disabled={premiumStatus.tier === "supporter"}
                className="w-full font-body gap-2"
              >
                <Heart className="w-4 h-4" />
                {premiumStatus.tier === "supporter" ? "You're a supporter!" : "Become a supporter"}
              </Button>
            </div>
          </motion.div>

          {/* Champion tier */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={`rounded-2xl border-2 p-5 space-y-4 transition-all ${
              premiumStatus.tier === "champion"
                ? "border-amber-500 bg-amber-500/5"
                : "border-border bg-card hover:border-amber-500/50"
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <p className="font-display text-xl font-bold">{PREMIUM_TIERS.champion.name}</p>
                </div>
                <p className="text-sm font-body text-muted-foreground">
                  {PREMIUM_TIERS.champion.description}
                </p>
              </div>
              {premiumStatus.tier === "champion" && (
                <Badge variant="secondary" className="font-body bg-amber-500/20 text-amber-400">
                  Active
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {PREMIUM_TIERS.champion.perks.map((perk, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm font-body">
                  <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  {perk}
                </div>
              ))}
            </div>

            <div className="bg-amber-500/10 rounded-lg p-3">
              <p className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2">
                Monthly rewards
              </p>
              <div className="flex gap-3 text-sm font-body">
                <div>
                  <p className="font-semibold">1,500 Tokens</p>
                </div>
                <div>
                  <p className="font-semibold">5 Packs</p>
                </div>
                <div>
                  <p className="font-semibold">1 Exclusive card</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-2xl font-display font-black">
                $15<span className="text-sm font-body text-muted-foreground">/month</span>
              </p>
              <Button
                onClick={() => handleDonation("champion")}
                disabled={premiumStatus.tier === "champion"}
                className="w-full font-body gap-2 bg-amber-600 hover:bg-amber-700"
              >
                <Sparkles className="w-4 h-4" />
                {premiumStatus.tier === "champion" ? "You're a champion!" : "Become a champion"}
              </Button>
            </div>
          </motion.div>
        </div>

        {/* What you get */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <p className="font-display font-bold text-lg">What all cards access means</p>
          <ul className="space-y-2 text-sm font-body text-muted-foreground">
            <li>✓ Use any card in deck building immediately (no grinding for rare cards)</li>
            <li>✓ Access to all future released cards as they're added</li>
            <li>✓ Play ranked with full power without collection limits</li>
            <li>✓ Still earn cards and packs through battles and battle pass</li>
            <li>✓ No pay-to-win — skill determines match outcomes</li>
          </ul>
        </motion.div>

        {/* FAQ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-2xl border border-border bg-card p-5 space-y-4"
        >
          <p className="font-display font-bold text-lg">Questions?</p>
          <div className="space-y-3 text-sm font-body">
            <div>
              <p className="font-semibold text-foreground mb-1">Can I cancel anytime?</p>
              <p className="text-muted-foreground">Yes. Auto-renewal can be turned off at any time.</p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Where does the money go?</p>
              <p className="text-muted-foreground">
                All donations support game development, server costs, and your favorite features.
              </p>
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">Is there a free way to get all cards?</p>
              <p className="text-muted-foreground">
                No. We keep the game free-to-play with a generous free tier. Premium helps fund ongoing development.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
}
