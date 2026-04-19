import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gift, Loader2, Sparkles, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import db from "@/lib/localDb";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { PACK_TYPES, openPack } from "@/lib/packSystem";
import { getCardById, hydrateCardsByIds } from "@/lib/cardCatalog";
import { TypeIcon } from "@/lib/typeIcons";

export default function PackShop() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [tokens, setTokens] = useState(5000); // Mock token balance
  const [pulledCards, setPulledCards] = useState(null);
  const [animatingCards, setAnimatingCards] = useState([]);

  const openPackMutation = useMutation({
    mutationFn: async (packType) => {
      const config = PACK_TYPES[packType];
      if (tokens < config.cost) {
        throw new Error("Not enough tokens");
      }

      setTokens(prev => prev - config.cost);
      const pull = openPack(packType);
      setPulledCards(pull);

      // Animate cards one by one
      setAnimatingCards([]);
      for (let i = 0; i < pull.cards.length; i++) {
        await new Promise(r => setTimeout(r, 300));
        setAnimatingCards(prev => [...prev, i]);
      }

      return pull;
    },
    onSuccess: (pull) => {
      toast({ title: "Pack opened!", description: `Got ${pull.cards.length} cards!` });
    },
    onError: (e) => {
      toast({ title: "Failed", description: e.message });
      setTokens(prev => prev + PACK_TYPES[Object.keys(PACK_TYPES)[0]].cost);
    },
  });

  const closePullAnimation = () => {
    setPulledCards(null);
    setAnimatingCards([]);
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button onClick={() => navigate("/collection")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm">
            <ArrowLeft className="w-4 h-4" /> Collection
          </button>
          <p className="font-display font-bold text-base">Pack Shop</p>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-3 py-1.5 font-display font-bold text-sm">
            <Sparkles className="w-4 h-4 text-yellow-500" />
            {tokens}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        <PageHeader title="Pack Shop" subtitle="Open booster packs to expand your collection" />

        {/* Pull animation */}
        <AnimatePresence>
          {pulledCards && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            >
              <div className="w-full max-w-4xl space-y-6">
                <p className="text-center font-display text-2xl font-bold text-white">
                  You pulled {pulledCards.cards.length} cards!
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {pulledCards.cards.map((card, idx) => (
                    <AnimatePresence key={card.id}>
                      {animatingCards.includes(idx) && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.3, rotateY: -90 }}
                          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                          transition={{ duration: 0.5, type: "spring" }}
                          className="aspect-[5/7] rounded-xl overflow-hidden border-2 border-primary/50"
                        >
                          <div className="relative h-full bg-secondary flex items-center justify-center">
                            {card.image_small || card.image_large ? (
                              <img
                                src={card.image_small || card.image_large}
                                alt={card.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <TypeIcon type={card.energy_type || "colorless"} size={48} />
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <p className="text-xs font-body font-bold text-white truncate">{card.name}</p>
                              <p className="text-[10px] text-white/60 capitalize">{card.rarity || "common"}</p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  ))}
                </div>

                <div className="flex gap-3 justify-center">
                  <Button onClick={closePullAnimation} className="font-body gap-2">
                    <ShoppingBag className="w-4 h-4" /> Open another pack
                  </Button>
                  <Button onClick={() => { closePullAnimation(); navigate("/collection"); }} variant="outline" className="font-body">
                    View collection
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pack offerings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(PACK_TYPES).map(([key, config]) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-5 space-y-4 hover:border-primary/50 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-display font-bold text-lg">{config.name}</p>
                    <p className="text-sm font-body text-muted-foreground">{config.cards} cards per pack</p>
                  </div>
                  <Badge variant="secondary" className="font-display font-bold">
                    {config.cost} Tokens
                  </Badge>
                </div>
                <p className="text-sm font-body text-muted-foreground">{config.description}</p>
              </div>

              {/* Guaranteed rewards */}
              {Object.keys(config.guaranteed).length > 0 && (
                <div className="bg-background rounded-lg p-3 space-y-1">
                  <p className="text-xs font-body font-semibold text-muted-foreground uppercase tracking-widest">
                    Guaranteed
                  </p>
                  {Object.entries(config.guaranteed).map(([rarity, count]) => (
                    <p key={rarity} className="text-xs font-body text-foreground/70 capitalize">
                      ✓ {count}× {rarity.replace(/_/g, " ")}
                    </p>
                  ))}
                </div>
              )}

              <Button
                onClick={() => openPackMutation.mutate(key)}
                disabled={openPackMutation.isPending || tokens < config.cost}
                className="w-full font-body gap-2"
              >
                {openPackMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Opening...
                  </>
                ) : tokens < config.cost ? (
                  "Not enough tokens"
                ) : (
                  <>
                    <Gift className="w-4 h-4" /> Open pack
                  </>
                )}
              </Button>
            </motion.div>
          ))}
        </div>

        {/* Token shop teaser */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-display font-bold text-lg mb-1">Running low on tokens?</p>
              <p className="text-sm font-body text-muted-foreground">Complete battle pass challenges to earn free tokens</p>
            </div>
            <Button onClick={() => navigate("/battle-pass")} variant="outline" size="sm" className="font-body">
              Battle pass
            </Button>
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
