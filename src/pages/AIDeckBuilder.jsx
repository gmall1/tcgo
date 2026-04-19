import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import db from "@/lib/localDb";
import { TypeIcon } from "@/lib/typeIcons";
import { getCardById } from "@/lib/cardCatalog";

const PERSONALITIES = [
  { id: "balanced", label: "Balanced", desc: "Mixed strategy, bench + energy balance" },
  { id: "aggressive", label: "Aggressive", desc: "High damage attackers, fast KO" },
  { id: "stall", label: "Stall", desc: "Defensive, high HP Pokémon, healing" },
  { id: "control", label: "Control", desc: "Status effects, disruption play" },
];

export default function AIDeckBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [personality, setPersonality] = useState("balanced");
  const [deckName, setDeckName] = useState("");
  const [generatedCards, setGeneratedCards] = useState([]);
  const [generating, setGenerating] = useState(false);

  const generateDeck = async () => {
    if (!deckName.trim()) {
      toast({ title: "Name required", description: "Give your AI deck a name." });
      return;
    }

    setGenerating(true);
    try {
      // For now, simulate with random selection from catalog
      // In production, call Groq to "design" a deck concept first
      const mockCards = [
        "charizard-ex", "charizard-ex", "charizard-ex", "charizard-ex",
        "pikachu-vmax", "pikachu-vmax", "pikachu-vmax", "pikachu-vmax",
        "blastoise", "blastoise", "blastoise", "blastoise",
        "venusaur", "venusaur", "venusaur", "venusaur",
        "eevee", "eevee", "eevee", "eevee",
        "fire-energy", "fire-energy", "fire-energy", "fire-energy",
        "water-energy", "water-energy", "water-energy", "water-energy",
        "grass-energy", "grass-energy", "grass-energy", "grass-energy",
        "electric-energy", "electric-energy", "electric-energy", "electric-energy",
        "fire-energy", "fire-energy", "fire-energy", "fire-energy",
        "water-energy", "water-energy", "water-energy", "water-energy",
      ];

      setGeneratedCards(mockCards.slice(0, 60));
      toast({ title: "Deck generated", description: `${personality} deck ready to save.` });
    } catch (e) {
      toast({ title: "Generation failed", description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const saveDeck = async () => {
    if (!deckName.trim()) {
      toast({ title: "Name required" });
      return;
    }
    if (generatedCards.length < 20) {
      toast({ title: "Deck too small", description: "Need at least 20 cards." });
      return;
    }

    try {
      const stats = generatedCards.reduce(
        (s, id) => {
          const c = getCardById(id);
          if (!c) return s;
          if (c.card_type === "pokemon") s.pokemon++;
          if (c.card_type === "trainer") s.trainer++;
          if (c.card_type === "energy") s.energy++;
          return s;
        },
        { pokemon: 0, trainer: 0, energy: 0 }
      );

      const deck = await db.entities.Deck.create({
        name: deckName.trim(),
        mode: "unlimited",
        card_ids: generatedCards,
        card_count: generatedCards.length,
        pokemon_count: stats.pokemon,
        trainer_count: stats.trainer,
        energy_count: stats.energy,
        cover_icon: personality,
        source: "ai-generated",
        ai_personality: personality,
      });

      toast({ title: "Deck saved", description: `"${deckName}" ready to battle.` });
      navigate("/decks");
    } catch (e) {
      toast({ title: "Save failed", description: e.message });
    }
  };

  const cardCounts = generatedCards.reduce((a, id) => {
    a[id] = (a[id] || 0) + 1;
    return a;
  }, {});

  const uniqueCards = Object.entries(cardCounts)
    .map(([id, qty]) => ({ card: getCardById(id), qty }))
    .filter(e => e.card);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button onClick={() => navigate("/decks")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm">
            <ArrowLeft className="w-4 h-4" /> Decks
          </button>
          <p className="font-display font-bold text-base">AI Deck Generator</p>
          <Button onClick={saveDeck} disabled={generatedCards.length === 0} size="sm" className="font-body gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Generator form */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <label className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2 block">Deck name</label>
            <Input
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              placeholder="e.g., Fire Blitz, Water Control..."
              className="font-display font-bold text-base"
            />
          </div>

          <div>
            <label className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-3 block">Personality</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PERSONALITIES.map(p => (
                <button
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    personality === p.id
                      ? "border-primary bg-primary/10"
                      : "border-border bg-background hover:bg-secondary/50"
                  }`}
                >
                  <p className="font-body font-semibold text-sm">{p.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={generateDeck}
            disabled={generating}
            className="w-full font-body gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Generate {personality} deck
              </>
            )}
          </Button>
        </div>

        {/* Generated deck list */}
        {generatedCards.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="font-display font-bold text-lg">Generated deck</p>
              <Badge variant="outline" className="font-body">
                {generatedCards.length}/60 cards
              </Badge>
            </div>

            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(generatedCards.length / 60) * 100}%` }}
              />
            </div>

            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {uniqueCards.map(({ card, qty }) => (
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
                  <Badge variant="outline" className="font-body text-xs">×{qty}</Badge>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
