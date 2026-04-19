import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Copy, Download, ExternalLink, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import db from "@/lib/localDb";
import { getCardById } from "@/lib/cardCatalog";
import { TypeIcon } from "@/lib/typeIcons";

export default function DeckShare() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const deckId = searchParams.get("id");

  const { data: deck, isLoading } = useQuery({
    queryKey: ["shared-deck", deckId],
    queryFn: () => deckId ? db.entities.Deck.get(deckId) : null,
    enabled: Boolean(deckId),
  });

  const shareUrl = useMemo(() => {
    if (!deckId) return "";
    const url = new URL(window.location.origin);
    url.pathname = "/deck-share";
    url.searchParams.set("id", deckId);
    return url.toString();
  }, [deckId]);

  const selectedCards = useMemo(() => {
    if (!deck?.card_ids) return [];
    const counts = deck.card_ids.reduce((a, id) => {
      a[id] = (a[id] || 0) + 1;
      return a;
    }, {});
    return Object.entries(counts)
      .map(([id, qty]) => ({ card: getCardById(id), quantity: qty }))
      .filter(e => e.card)
      .sort((a, b) => a.card.name.localeCompare(b.card.name));
  }, [deck]);

  const importDeck = async () => {
    if (!deck) return;
    try {
      const imported = await db.entities.Deck.create({
        name: `${deck.name} (imported)`,
        mode: deck.mode || "unlimited",
        card_ids: deck.card_ids || [],
        card_count: deck.card_count || 0,
        pokemon_count: deck.pokemon_count || 0,
        trainer_count: deck.trainer_count || 0,
        energy_count: deck.energy_count || 0,
        cover_icon: deck.cover_icon,
        cover_image: deck.cover_image,
        source: "imported",
      });
      toast({ title: "Deck imported", description: `"${imported.name}" added to your decks.` });
      navigate(`/deck-builder?id=${imported.id}`);
    } catch (e) {
      toast({ title: "Import failed", description: e.message });
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(shareUrl).then(() =>
      toast({ title: "Link copied", description: "Share with friends!" })
    );
  };

  const downloadDeck = () => {
    const deckJson = JSON.stringify(deck, null, 2);
    const blob = new Blob([deckJson], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${deck.name || "deck"}.json`;
    a.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center">
          <p className="font-display text-2xl font-bold mb-2">Deck not found</p>
          <p className="text-muted-foreground font-body mb-6">This deck doesn't exist or has been deleted.</p>
          <Button onClick={() => navigate("/decks")} className="font-body gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to decks
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button onClick={() => navigate("/decks")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm">
            <ArrowLeft className="w-4 h-4" /> Decks
          </button>
          <p className="font-display font-bold text-base">Deck share</p>
          <div />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Deck header */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div>
              <p className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2">Shared deck</p>
              <h1 className="font-display text-3xl font-black">{deck.name}</h1>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="capitalize font-body">{deck.mode || "unlimited"}</Badge>
              <Badge variant="secondary" className="font-body">
                {deck.card_count || 0}/60 cards
              </Badge>
              {deck.pokemon_count > 0 && <Badge variant="outline" className="font-body">{deck.pokemon_count} Pokémon</Badge>}
              {deck.trainer_count > 0 && <Badge variant="outline" className="font-body">{deck.trainer_count} Trainer</Badge>}
              {deck.energy_count > 0 && <Badge variant="outline" className="font-body">{deck.energy_count} Energy</Badge>}
            </div>

            {deck.cover_image && (
              <img src={deck.cover_image} alt={deck.name} className="w-full h-32 object-cover rounded-xl" />
            )}

            {/* Share buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button onClick={copyShareLink} variant="outline" size="sm" className="font-body gap-2">
                <Share2 className="w-3.5 h-3.5" /> Copy link
              </Button>
              <Button onClick={downloadDeck} variant="outline" size="sm" className="font-body gap-2">
                <Download className="w-3.5 h-3.5" /> Download JSON
              </Button>
              <Button onClick={importDeck} size="sm" className="font-body gap-2">
                <ExternalLink className="w-3.5 h-3.5" /> Import to my decks
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Card list */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-display font-bold text-lg mb-4">{selectedCards.length} unique cards</p>

            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {selectedCards.map(({ card, quantity }) => (
                <div key={card.id} className="flex items-center gap-3 p-2 rounded-lg border border-border bg-background hover:bg-secondary/30 transition-colors">
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-secondary flex items-center justify-center flex-shrink-0">
                    {card.image_small ? (
                      <img src={card.image_small} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <TypeIcon type={card.energy_type || "colorless"} size={16} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-body font-semibold text-sm truncate">{card.name}</p>
                    <p className="text-[11px] text-muted-foreground font-body">{card.set_name || "Local"}</p>
                  </div>
                  <Badge variant="outline" className="font-body text-xs">×{quantity}</Badge>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Shareable link */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-display font-bold text-base mb-3">Share this link</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-muted-foreground truncate"
              />
              <Button onClick={copyShareLink} size="sm" variant="outline" className="font-body">
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
