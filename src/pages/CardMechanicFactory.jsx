import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Plus, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { fetchCatalogCards } from "@/lib/cardCatalog";
import { TypeIcon } from "@/lib/typeIcons";

const MECHANIC_TAGS = [
  "Coin Flip",
  "Damage Modifiers",
  "Energy Acceleration",
  "Draw Cards",
  "Search Deck",
  "Bench Swap",
  "Discard",
  "Heal",
  "Status Condition",
  "Energy Denial",
  "Hand Disrupt",
  "Damage Spread",
  "Damage Counter",
  "Weakness Abuse",
  "Trainer Lock",
  "Ability Lock",
  "Retreat Cost",
  "Prize Draw",
  "Recursion",
  "Stun/Skip Turn",
];

export default function CardMechanicFactory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSet, setSelectedSet] = useState("");
  const [mechanics, setMechanics] = useState({});
  const [notes, setNotes] = useState({});
  const [filter, setFilter] = useState("all");

  const { data: cards = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["factory-cards", selectedSet, filter],
    queryFn: () =>
      fetchCatalogCards({
        search: "",
        filter: filter === "all" ? "all" : filter,
        setId: selectedSet,
        page: 1,
        pageSize: 100,
      }).then(r => r.cards || []),
    enabled: Boolean(selectedSet),
  });

  const currentCard = useMemo(() => cards[currentIndex] || null, [cards, currentIndex]);
  const cardMechanicsTagged = useMemo(() => mechanics[currentCard?.id] || [], [mechanics, currentCard?.id]);
  const cardNotes = useMemo(() => notes[currentCard?.id] || "", [notes, currentCard?.id]);

  const toggleMechanic = (tag) => {
    if (!currentCard) return;
    setMechanics(prev => {
      const current = prev[currentCard.id] || [];
      const updated = current.includes(tag)
        ? current.filter(t => t !== tag)
        : [...current, tag];
      return { ...prev, [currentCard.id]: updated };
    });
  };

  const saveMechanics = () => {
    // In production, save to localStorage or backend
    const data = JSON.stringify({ mechanics, notes });
    localStorage.setItem("card-mechanics-factory", data);
    toast({ title: "Saved", description: `${Object.keys(mechanics).length} cards tagged.` });
  };

  const exportData = () => {
    const data = { mechanics, notes, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "card-mechanics.json";
    a.click();
  };

  const nextCard = () => {
    if (currentIndex < cards.length - 1) setCurrentIndex(currentIndex + 1);
  };
  const prevCard = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  if (!selectedSet) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 pt-8">
          <PageHeader title="CARD MECHANIC FACTORY" subtitle="Tag cards by mechanics, one by one" />
          <div className="mt-5">
            <p className="text-sm font-body text-muted-foreground mb-4">
              This tool helps you manually catalog card mechanics. No Groq needed — just read the card text and click the mechanics it uses.
            </p>
            <p className="text-sm font-body text-muted-foreground mb-6">
              Select an expansion to start:
            </p>
            <Button onClick={() => navigate("/collection")} className="font-body">
              Go pick a set
            </Button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => {
              saveMechanics();
              navigate("/admin");
            }}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <p className="font-display font-bold text-base">
            {currentIndex + 1}/{cards.length}
          </p>
          <Button onClick={saveMechanics} size="sm" className="font-body gap-1.5">
            <Save className="w-3.5 h-3.5" /> Save
          </Button>
        </div>
      </div>

      {cardsLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : !currentCard ? (
        <div className="text-center py-20 px-4">
          <p className="font-display text-lg font-bold">No cards found</p>
          <p className="text-muted-foreground font-body mt-2">Try a different filter.</p>
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
          {/* Card display */}
          <motion.div
            key={currentCard.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-2xl border border-border bg-card overflow-hidden"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
              {/* Art */}
              <div className="md:col-span-1">
                <div className="aspect-[5/7] rounded-xl overflow-hidden bg-secondary flex items-center justify-center">
                  {currentCard.image_small || currentCard.image_large ? (
                    <img
                      src={currentCard.image_small || currentCard.image_large}
                      alt={currentCard.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <TypeIcon type={currentCard.energy_type || "colorless"} size={48} />
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <p className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-1">
                    {currentCard.set_name}
                  </p>
                  <p className="font-display text-2xl font-bold">{currentCard.name}</p>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant="secondary" className="capitalize text-xs">
                      {currentCard.card_type}
                    </Badge>
                    {currentCard.energy_type && (
                      <Badge variant="outline" className="capitalize text-xs flex items-center gap-1">
                        <TypeIcon type={currentCard.energy_type} size={12} />
                        {currentCard.energy_type}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Card text preview */}
                <div className="bg-background rounded-xl p-3 space-y-2 max-h-32 overflow-y-auto">
                  {currentCard.card_type === "pokemon" && (
                    <>
                      {currentCard.hp && (
                        <p className="text-xs font-body">
                          <span className="font-semibold">HP:</span> {currentCard.hp}
                        </p>
                      )}
                      {currentCard.attack1_name && (
                        <div className="text-xs font-body space-y-0.5">
                          <p className="font-semibold">{currentCard.attack1_name}</p>
                          <p className="text-muted-foreground italic">
                            {currentCard.attack1_damage || 0} damage · {currentCard.attack1_cost} energy
                          </p>
                        </div>
                      )}
                      {currentCard.attack2_name && (
                        <div className="text-xs font-body space-y-0.5">
                          <p className="font-semibold">{currentCard.attack2_name}</p>
                          <p className="text-muted-foreground italic">
                            {currentCard.attack2_damage || 0} damage · {currentCard.attack2_cost} energy
                          </p>
                        </div>
                      )}
                    </>
                  )}
                  {currentCard.description && (
                    <p className="text-xs font-body text-muted-foreground">{currentCard.description}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Mechanics selector */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <p className="font-display font-bold text-lg">
              What mechanics does this card use?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MECHANIC_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleMechanic(tag)}
                  className={`px-3 py-2 rounded-lg border text-xs font-body text-center transition-all ${
                    cardMechanicsTagged.includes(tag)
                      ? "border-primary bg-primary/10 text-primary font-semibold"
                      : "border-border bg-background hover:bg-secondary/50 text-muted-foreground"
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2 block">
                Additional notes (optional)
              </label>
              <Input
                value={cardNotes}
                onChange={e =>
                  setNotes(prev => ({
                    ...prev,
                    [currentCard.id]: e.target.value,
                  }))
                }
                placeholder="e.g., 'Synergy with energy acceleration', 'Watch for weakness'"
                className="font-body text-sm"
              />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex gap-2 justify-between">
            <Button
              onClick={prevCard}
              disabled={currentIndex === 0}
              variant="outline"
              size="sm"
              className="font-body gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </Button>

            <div className="flex gap-2">
              <Button onClick={saveMechanics} size="sm" variant="outline" className="font-body gap-1.5">
                <Save className="w-3.5 h-3.5" /> Save progress
              </Button>
              <Button onClick={exportData} size="sm" variant="outline" className="font-body gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Export JSON
              </Button>
            </div>

            <Button
              onClick={nextCard}
              disabled={currentIndex === cards.length - 1}
              size="sm"
              className="font-body gap-1.5"
            >
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
      <BottomNav />
    </div>
  );
}
