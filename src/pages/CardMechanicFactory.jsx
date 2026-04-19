import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Save,
  Search,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { fetchCatalogCards, fetchExpansionSetsCached } from "@/lib/cardCatalog";
import { TypeIcon } from "@/lib/typeIcons";

const STORAGE_KEY = "tcg_card_mechanics_factory_v2";
const PAGE_SIZE = 200;

const MECHANIC_TAGS = [
  { id: "coin-flip", label: "Coin Flip", desc: "Requires random outcome" },
  { id: "damage-modifiers", label: "Damage Modifiers", desc: "Changes damage amount" },
  { id: "energy-acceleration", label: "Energy Acceleration", desc: "Attaches extra energy" },
  { id: "draw-cards", label: "Draw Cards", desc: "Draw extra cards" },
  { id: "search-deck", label: "Search Deck", desc: "Find specific cards from deck" },
  { id: "bench-swap", label: "Bench Swap", desc: "Switches Pokémon" },
  { id: "discard", label: "Discard", desc: "Removes cards from play" },
  { id: "heal", label: "Heal", desc: "Restores HP" },
  { id: "status-condition", label: "Status Condition", desc: "Poison/burn/sleep/paralyze" },
  { id: "energy-denial", label: "Energy Denial", desc: "Removes opponent's energy" },
  { id: "hand-disrupt", label: "Hand Disrupt", desc: "Forces opponent discard" },
  { id: "damage-spread", label: "Damage Spread", desc: "Damages multiple targets" },
  { id: "damage-counter", label: "Damage Counter", desc: "Scales with counters" },
  { id: "weakness-abuse", label: "Weakness Abuse", desc: "Needs type weakness" },
  { id: "trainer-lock", label: "Trainer Lock", desc: "Prevents trainer cards" },
  { id: "ability-lock", label: "Ability Lock", desc: "Prevents abilities" },
  { id: "retreat-cost", label: "Retreat Cost", desc: "Changes retreat cost" },
  { id: "prize-draw", label: "Prize Draw", desc: "Affects prizes" },
  { id: "recursion", label: "Recursion", desc: "Returns cards from discard" },
  { id: "stun", label: "Stun / Skip Turn", desc: "Skips opponent's turn" },
];

const FILTERS = [
  { id: "all", label: "All" },
  { id: "untagged", label: "Untagged" },
  { id: "tagged", label: "Tagged" },
  { id: "pokemon", label: "Pokémon" },
  { id: "trainer", label: "Trainer" },
  { id: "energy", label: "Energy" },
];

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { mechanics: {}, notes: {} };
  } catch {
    return { mechanics: {}, notes: {} };
  }
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("Failed to persist mechanics state", err);
  }
}

export default function CardMechanicFactory() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedSet, setSelectedSet] = useState(() => localStorage.getItem("factory_last_set") || "");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mechanics, setMechanics] = useState({});
  const [notes, setNotes] = useState({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("untagged");
  const [setPickerOpen, setSetPickerOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Load saved state once
  useEffect(() => {
    const saved = readState();
    setMechanics(saved.mechanics || {});
    setNotes(saved.notes || {});
  }, []);

  // Autosave on every change
  useEffect(() => {
    writeState({ mechanics, notes });
  }, [mechanics, notes]);

  const { data: sets = [], isLoading: setsLoading } = useQuery({
    queryKey: ["factory-sets"],
    queryFn: () => fetchExpansionSetsCached(),
    staleTime: 1000 * 60 * 60,
  });

  const typeFilter = useMemo(() => {
    if (filter === "pokemon" || filter === "trainer" || filter === "energy") return filter;
    return "all";
  }, [filter]);

  const { data: cardsRaw = [], isLoading: cardsLoading } = useQuery({
    queryKey: ["factory-cards", selectedSet, typeFilter],
    queryFn: () =>
      fetchCatalogCards({
        search: "",
        filter: typeFilter,
        setId: selectedSet,
        page: 1,
        pageSize: PAGE_SIZE,
      }).then((r) => r.cards || []),
    enabled: Boolean(selectedSet),
  });

  const filteredCards = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cardsRaw.filter((card) => {
      const tagged = (mechanics[card.id] || []).length > 0;
      if (filter === "tagged" && !tagged) return false;
      if (filter === "untagged" && tagged) return false;
      if (!query) return true;
      return [card.name, card.set_name, card.rarity, card.attack1_name, card.attack2_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [cardsRaw, filter, search, mechanics]);

  // Reset index if filter changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [selectedSet, filter, search]);

  const currentCard = filteredCards[currentIndex] || null;
  const cardMechanicsTagged = useMemo(() => mechanics[currentCard?.id] || [], [mechanics, currentCard]);
  const cardNote = useMemo(() => notes[currentCard?.id] || "", [notes, currentCard]);

  const toggleMechanic = useCallback(
    (tagId) => {
      if (!currentCard) return;
      setMechanics((prev) => {
        const current = prev[currentCard.id] || [];
        const next = current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId];
        return { ...prev, [currentCard.id]: next };
      });
    },
    [currentCard]
  );

  const setNote = useCallback(
    (value) => {
      if (!currentCard) return;
      setNotes((prev) => ({ ...prev, [currentCard.id]: value }));
    },
    [currentCard]
  );

  const nextCard = useCallback(() => {
    setCurrentIndex((i) => Math.min(filteredCards.length - 1, i + 1));
  }, [filteredCards.length]);

  const prevCard = useCallback(() => {
    setCurrentIndex((i) => Math.max(0, i - 1));
  }, []);

  const jumpToFirstUntagged = useCallback(() => {
    const idx = filteredCards.findIndex((c) => !(mechanics[c.id] || []).length);
    if (idx >= 0) setCurrentIndex(idx);
    else toast({ title: "Nothing untagged", description: "All cards in this view are tagged." });
  }, [filteredCards, mechanics, toast]);

  const clearCurrent = useCallback(() => {
    if (!currentCard) return;
    setMechanics((prev) => {
      const next = { ...prev };
      delete next[currentCard.id];
      return next;
    });
    setNotes((prev) => {
      const next = { ...prev };
      delete next[currentCard.id];
      return next;
    });
  }, [currentCard]);

  const exportData = useCallback(() => {
    const data = {
      schema: "tcg-card-mechanics-v2",
      mechanics,
      notes,
      exportedAt: new Date().toISOString(),
      totalTagged: Object.keys(mechanics).filter((k) => (mechanics[k] || []).length).length,
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `card-mechanics-${Date.now()}.json`;
    a.click();
    toast({ title: "Exported", description: `${data.totalTagged} tagged cards saved to file.` });
  }, [mechanics, notes, toast]);

  const importData = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(String(e.target?.result || ""));
          if (!parsed || typeof parsed !== "object") throw new Error("Invalid file");
          const nextMechanics = { ...mechanics, ...(parsed.mechanics || {}) };
          const nextNotes = { ...notes, ...(parsed.notes || {}) };
          setMechanics(nextMechanics);
          setNotes(nextNotes);
          toast({
            title: "Imported",
            description: `Merged ${Object.keys(parsed.mechanics || {}).length} tagged cards.`,
          });
        } catch (err) {
          toast({ title: "Import failed", description: err.message });
        }
      };
      reader.readAsText(file);
      event.target.value = "";
    },
    [mechanics, notes, toast]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "j") nextCard();
      else if (e.key === "ArrowLeft" || e.key === "k") prevCard();
      else if (e.key === "Escape") setSetPickerOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [nextCard, prevCard]);

  // Persist last selected set
  useEffect(() => {
    if (selectedSet) localStorage.setItem("factory_last_set", selectedSet);
  }, [selectedSet]);

  const taggedCount = useMemo(
    () => Object.values(mechanics).filter((arr) => Array.isArray(arr) && arr.length).length,
    [mechanics]
  );
  const progressPct = filteredCards.length
    ? Math.round(
        (filteredCards.filter((c) => (mechanics[c.id] || []).length).length / filteredCards.length) * 100
      )
    : 0;

  const activeSet = sets.find((s) => s.id === selectedSet);

  return (
    <div className="min-h-screen bg-background pb-28">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <div className="flex items-center gap-2">
            <p className="font-display font-bold text-sm hidden sm:block">CARD FACTORY</p>
            <Badge variant="secondary" className="font-body">
              {taggedCount} tagged
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={importData}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="font-body gap-1.5"
              title="Import tagged mechanics JSON"
            >
              <Upload className="w-3.5 h-3.5" /> Import
            </Button>
            <Button onClick={exportData} size="sm" className="font-body gap-1.5">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-5 space-y-5">
        <PageHeader title="CARD MECHANIC FACTORY" subtitle="Tag cards by mechanic — progress auto-saves." />

        {/* Set picker */}
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground font-body">Active expansion</p>
              <p className="font-display text-base font-bold mt-1">
                {activeSet ? activeSet.name : selectedSet || "None selected"}
              </p>
              {activeSet?.total && (
                <p className="text-xs text-muted-foreground font-body mt-0.5">{activeSet.total} printed cards</p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSetPickerOpen(true)}
              className="font-body gap-1.5"
              disabled={setsLoading}
            >
              {setsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              {selectedSet ? "Change set" : "Pick set"}
            </Button>
          </div>

          {selectedSet && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={`px-3 py-1 rounded-full text-xs font-body border transition-colors ${
                      filter === f.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-border hover:bg-secondary"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter by name, rarity, attack..."
                    className="font-body pl-9 h-9"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={jumpToFirstUntagged} className="font-body">
                  Next untagged
                </Button>
              </div>
              {filteredCards.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-body text-muted-foreground">
                    <span>
                      {currentIndex + 1}/{filteredCards.length} in view · {progressPct}% tagged
                    </span>
                    <span className="hidden sm:inline">← / → or j / k to navigate</span>
                  </div>
                  <div className="h-1 rounded-full bg-secondary overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Body */}
        {!selectedSet ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-12 text-center">
            <p className="font-display text-base font-bold">Pick an expansion to begin</p>
            <p className="text-sm text-muted-foreground font-body mt-1">
              Progress is saved automatically in this browser.
            </p>
          </div>
        ) : cardsLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !currentCard ? (
          <div className="rounded-2xl border border-border bg-card p-12 text-center">
            <p className="font-display text-base font-bold">No cards match this filter.</p>
            <p className="text-sm text-muted-foreground font-body mt-1">Try a different filter or set.</p>
          </div>
        ) : (
          <>
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-5">
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

                <div className="md:col-span-2 space-y-4">
                  <div>
                    <p className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-1">
                      {currentCard.set_name || "Unknown set"}
                      {currentCard.rarity ? ` · ${currentCard.rarity}` : ""}
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
                      {cardMechanicsTagged.length > 0 && (
                        <Badge className="gap-1 bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> {cardMechanicsTagged.length} tagged
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="bg-background rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
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
                              {currentCard.attack1_damage || 0} damage · {currentCard.attack1_cost || "—"} energy
                            </p>
                            {currentCard.attack1_description && (
                              <p className="text-muted-foreground text-[11px]">{currentCard.attack1_description}</p>
                            )}
                          </div>
                        )}
                        {currentCard.attack2_name && (
                          <div className="text-xs font-body space-y-0.5">
                            <p className="font-semibold">{currentCard.attack2_name}</p>
                            <p className="text-muted-foreground italic">
                              {currentCard.attack2_damage || 0} damage · {currentCard.attack2_cost || "—"} energy
                            </p>
                            {currentCard.attack2_description && (
                              <p className="text-muted-foreground text-[11px]">{currentCard.attack2_description}</p>
                            )}
                          </div>
                        )}
                        {currentCard.abilities?.map((ability, i) => (
                          <div key={i} className="text-xs font-body space-y-0.5 border-t border-border pt-1.5">
                            <p className="font-semibold">Ability: {ability.name}</p>
                            <p className="text-muted-foreground text-[11px]">{ability.text}</p>
                          </div>
                        ))}
                      </>
                    )}
                    {currentCard.description && (
                      <p className="text-xs font-body text-muted-foreground">{currentCard.description}</p>
                    )}
                    {currentCard.rules?.length > 0 && (
                      <div className="text-xs font-body text-muted-foreground space-y-1">
                        {currentCard.rules.map((rule, i) => (
                          <p key={i}>{rule}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-display font-bold text-lg">Which mechanics does this card use?</p>
                {cardMechanicsTagged.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCurrent} className="font-body gap-1.5 text-muted-foreground">
                    <X className="w-3.5 h-3.5" /> Clear
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MECHANIC_TAGS.map((tag) => {
                  const active = cardMechanicsTagged.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleMechanic(tag.id)}
                      title={tag.desc}
                      className={`text-left px-3 py-2 rounded-xl border text-xs font-body transition-all ${
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background border-border hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    >
                      <span className="font-semibold block">{tag.label}</span>
                      <span className={`text-[10px] ${active ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {tag.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div>
                <p className="text-xs font-body text-muted-foreground mb-1.5">Notes (optional)</p>
                <textarea
                  value={cardNote}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. 'Only works vs Fire types' or 'Strong with energy acceleration'"
                  className="w-full min-h-[64px] text-xs font-body rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="sticky bottom-4 z-10 rounded-2xl border border-border bg-card/95 backdrop-blur p-3 flex items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={prevCard} className="font-body gap-1.5" disabled={currentIndex === 0}>
                <ChevronLeft className="w-4 h-4" /> Prev
              </Button>
              <div className="flex items-center gap-2 text-xs font-body text-muted-foreground">
                <Save className="w-3.5 h-3.5" /> Auto-saved
              </div>
              <Button size="sm" onClick={nextCard} className="font-body gap-1.5" disabled={currentIndex >= filteredCards.length - 1}>
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Set picker dialog */}
      <AnimatePresence>
        {setPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setSetPickerOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="w-full max-w-xl bg-card border border-border rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <p className="font-display font-bold text-base">Pick an expansion</p>
                <button
                  onClick={() => setSetPickerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-2">
                {setsLoading && <div className="p-4 text-center text-sm text-muted-foreground">Loading sets…</div>}
                {!setsLoading && sets.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">No sets available.</div>
                )}
                {sets.map((set) => (
                  <button
                    key={set.id}
                    onClick={() => {
                      setSelectedSet(set.id);
                      setSetPickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl mb-1 flex items-center gap-3 transition-colors ${
                      selectedSet === set.id ? "bg-primary/10 border border-primary" : "hover:bg-secondary"
                    }`}
                  >
                    {set.images?.symbol && (
                      <img src={set.images.symbol} alt="" className="w-6 h-6 object-contain" loading="lazy" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-body font-semibold text-sm truncate">{set.name}</p>
                      <p className="text-[11px] text-muted-foreground font-body">
                        {set.series || "Unknown series"} · {set.total || "?"} cards
                        {set.releaseDate ? ` · ${set.releaseDate}` : ""}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />
    </div>
  );
}
