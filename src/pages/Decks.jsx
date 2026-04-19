import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, Plus, ChevronRight, Layers, Share2, Sparkles } from "lucide-react";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import db from "@/lib/localDb";
import { TypeIcon, TYPE_META } from "@/lib/typeIcons";
import { getTypeStyle } from "@/lib/cardCatalog";

export default function Decks() {
  const { data: decks = [], isLoading } = useQuery({
    queryKey: ["decks"],
    queryFn: () => db.entities.Deck.list("-updated_date", 100),
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-8">
        <PageHeader
          title="MY DECKS"
          subtitle={`${decks.length} saved locally`}
          rightAction={
            <div className="flex gap-2">
              <Link to="/ai-deck-builder">
                <Button size="sm" variant="outline" className="font-body gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  AI Build
                </Button>
              </Link>
              <Link to="/deck-builder">
                <Button size="sm" className="font-body gap-1.5">
                  <Plus className="w-4 h-4" />
                  New
                </Button>
              </Link>
            </div>
          }
        />

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : decks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-5 space-y-2.5">
            {decks.map((deck, index) => <DeckRow key={deck.id} deck={deck} index={index} />)}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function DeckRow({ deck, index }) {
  const style = getTypeStyle(deck.cover_icon ? "colorless" : "colorless");
  const typeKey = (deck.cover_icon || "colorless").toLowerCase();
  const pct = Math.min(100, ((deck.card_count || 0) / 60) * 100);
  const isComplete = (deck.card_count || 0) >= 60;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.16) }}
    >
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4 hover:bg-secondary/40 transition-colors group">
        <Link to={`/deck-builder?id=${deck.id}`} className="flex-1 flex items-center gap-4">
          {/* Cover art or type icon */}
          <div className="w-14 h-20 rounded-xl overflow-hidden flex-shrink-0 border border-border bg-background">
            {deck.cover_image ? (
              <img src={deck.cover_image} alt={deck.name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-secondary flex items-center justify-center">
                {deck.cover_icon && deck.cover_icon.length < 12
                  ? <TypeIcon type={deck.cover_icon} size={28} />
                  : <Layers className="w-6 h-6 text-muted-foreground" />}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            <div>
              <p className="font-display font-bold text-base leading-tight truncate">{deck.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="font-body text-[10px] capitalize px-1.5 py-0">{deck.mode || "unlimited"}</Badge>
                <span className="text-[11px] font-body text-muted-foreground">
                  {deck.pokemon_count || 0} Poke · {deck.trainer_count || 0} Trainer · {deck.energy_count || 0} Energy
                </span>
              </div>
            </div>

            {/* Deck completeness bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[10px] font-body ${isComplete ? "text-emerald-400" : "text-muted-foreground"}`}>
                  {deck.card_count || 0}/60 cards{isComplete ? " — complete" : ""}
                </span>
              </div>
              <div className="h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${isComplete ? "bg-emerald-500" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
        </Link>
        
        <Link to={`/deck-share?id=${deck.id}`} title="Share deck">
          <button className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-secondary transition-colors flex-shrink-0">
            <Share2 className="w-4 h-4" />
          </button>
        </Link>
      </div>
    </motion.div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-20">
      <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto flex items-center justify-center mb-4">
        <Layers className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-display text-lg font-bold mb-2">No Decks Yet</h3>
      <p className="text-muted-foreground font-body text-sm mb-6 max-w-xs mx-auto">
        Build a deck from live expansions and save it to your browser.
      </p>
      <Link to="/deck-builder">
        <Button className="font-body gap-2">
          <Plus className="w-4 h-4" />
          Create Deck
        </Button>
      </Link>
    </div>
  );
}
