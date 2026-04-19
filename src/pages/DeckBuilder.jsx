import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Layers, Loader2, Plus, Save, Search, Trash2, X, CheckCircle2, SlidersHorizontal } from "lucide-react";
import { TypeIcon, TYPE_META } from "@/lib/typeIcons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import db from "@/lib/localDb";
import {
  buildStarterDeck,
  fetchCatalogCards,
  fetchExpansionSetsCached,
  getCardById,
  getTypeStyle,
  hydrateCardsByIds,
} from "@/lib/cardCatalog";

const FILTERS = ["all", "pokemon", "trainer", "energy"];
const ENERGY_TYPES = ["all","fire","water","grass","lightning","psychic","fighting","darkness","metal","dragon","fairy","colorless"];

function countCards(cardIds = []) {
  return cardIds.reduce((acc, id) => { acc[id] = (acc[id] || 0) + 1; return acc; }, {});
}

function CardTile({ card, inDeck, onAdd, onRemove, disabled }) {
  const style = getTypeStyle(card.energy_type || "colorless");
  const img = card.image_small || card.image_large;
  const count = inDeck || 0;
  const isEnergy = card.card_type === "energy";
  const maxCopies = isEnergy ? 60 : 4;
  const canAdd = !disabled && count < maxCopies;
  const canRemove = count > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className="relative rounded-2xl border border-border bg-card overflow-hidden group"
    >
      {/* art */}
      <div className={`relative aspect-[5/7] bg-gradient-to-br ${style.bg} flex items-center justify-center overflow-hidden`}>
        {img
          ? <img src={img} alt={card.name} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" loading="lazy" />
          : <TypeIcon type={card.energy_type || "colorless"} size={48} />
        }
        {/* count badge */}
        {count > 0 && (
          <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-primary text-primary-foreground font-display font-bold text-sm flex items-center justify-center shadow-lg">
            {count}
          </div>
        )}
        {/* overlay controls */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-end justify-center pb-3 gap-2 opacity-0 group-hover:opacity-100">
          {canRemove && (
            <button
              onClick={() => onRemove(card.id)}
              className="w-9 h-9 rounded-full bg-red-600/90 text-white flex items-center justify-center hover:bg-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          {canAdd && (
            <button
              onClick={() => onAdd(card)}
              className="w-9 h-9 rounded-full bg-primary/90 text-primary-foreground flex items-center justify-center hover:bg-primary transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* info */}
      <div className="p-2.5 space-y-1.5">
        <p className="font-display font-bold text-sm leading-tight truncate">{card.name}</p>
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-[10px] capitalize px-1.5 py-0">{card.card_type}</Badge>
          {card.energy_type && <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{card.energy_type}</Badge>}
          {card.stage && <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{card.stage}</Badge>}
        </div>
        {card.card_type === "pokemon" && (
          <p className="text-[11px] font-body text-muted-foreground truncate">
            HP {card.hp || "—"} {card.attack1_name ? `· ${card.attack1_name} (${card.attack1_damage || 0})` : ""}
          </p>
        )}
        {card.card_type !== "pokemon" && card.description && (
          <p className="text-[11px] font-body text-muted-foreground line-clamp-2">{card.description}</p>
        )}
      </div>
    </motion.div>
  );
}

function DeckSlotRow({ card, quantity, onRemove }) {
  const style = getTypeStyle(card.energy_type || "colorless");
  const img = card.image_small || card.image_large;
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl border border-border bg-background hover:bg-secondary/40 transition-colors">
      <div className={`w-10 h-14 rounded-lg overflow-hidden bg-gradient-to-br ${style.bg} flex-shrink-0 flex items-center justify-center`}>
        {img ? <img src={img} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
          : <TypeIcon type={card.energy_type || "colorless"} size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-body font-semibold text-sm truncate">{card.name}</p>
        <p className="text-[11px] text-muted-foreground font-body">{card.set_name || "Local"}</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge variant="outline" className="font-body text-xs">×{quantity}</Badge>
        <button
          onClick={() => onRemove(card.id)}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function DeckBuilder() {
  const urlParams = new URLSearchParams(window.location.search);
  const deckId = urlParams.get("id");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [deckName, setDeckName] = useState("New Deck");
  const [mode, setMode] = useState("unlimited");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showTypes, setShowTypes] = useState(false);
  const [selectedSet, setSelectedSet] = useState("");
  const [deckCardIds, setDeckCardIds] = useState(() => buildStarterDeck());
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: existingDeck, isLoading } = useQuery({
    queryKey: ["deck", deckId],
    queryFn: () => (deckId ? db.entities.Deck.get(deckId) : null),
    enabled: Boolean(deckId),
  });

  const { data: sets = [] } = useQuery({
    queryKey: ["expansion-sets"],
    queryFn: () => fetchExpansionSetsCached(),
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (!selectedSet && sets.length > 0) setSelectedSet(sets[0].id);
  }, [selectedSet, sets]);

  useEffect(() => {
    if (!existingDeck) return;
    setDeckName(existingDeck.name || "Imported Deck");
    setMode(existingDeck.mode || "unlimited");
    setDeckCardIds(existingDeck.card_ids || []);
  }, [existingDeck]);

  useEffect(() => {
    let cancelled = false;
    hydrateCardsByIds(deckCardIds).then(() => {
      if (!cancelled) setCatalogVersion(v => v + 1);
    }).catch(() => {
      if (!cancelled) setCatalogVersion(v => v + 1);
    });
    return () => { cancelled = true; };
  }, [deckCardIds]);

  const { data: cardResults, isFetching } = useQuery({
    queryKey: ["deck-builder-cards", selectedSet, search, filter, typeFilter],
    queryFn: () => fetchCatalogCards({ search, filter, setId: selectedSet, page: 1, pageSize: 48 }),
    enabled: Boolean(selectedSet),
    staleTime: 1000 * 60 * 10,
  });

  const deckCounts = useMemo(() => countCards(deckCardIds), [deckCardIds]);

  const selectedCards = useMemo(() => {
    return Object.entries(deckCounts)
      .map(([id, qty]) => ({ card: getCardById(id), quantity: qty }))
      .filter(e => e.card)
      .sort((a, b) => a.card.name.localeCompare(b.card.name));
  }, [catalogVersion, deckCounts]);

  const stats = useMemo(() => {
    return deckCardIds.reduce((s, id) => {
      const c = getCardById(id);
      if (!c) return s;
      if (c.card_type === "pokemon") s.pokemon++;
      if (c.card_type === "trainer") s.trainer++;
      if (c.card_type === "energy") s.energy++;
      return s;
    }, { pokemon: 0, trainer: 0, energy: 0 });
  }, [catalogVersion, deckCardIds]);

  const filteredCards = useMemo(() => {
    const base = cardResults?.cards || [];
    if (typeFilter === "all") return base;
    return base.filter(c => {
      const et = (c.energy_type || "").toLowerCase();
      const tf = typeFilter.toLowerCase();
      return et === tf || (tf === "lightning" && et === "electric");
    });
  }, [cardResults, typeFilter]);

  const activeSet = useMemo(() => sets.find(s => s.id === selectedSet) || null, [selectedSet, sets]);

  const addCard = (card) => {
    const count = deckCounts[card.id] || 0;
    const limit = card.card_type === "energy" ? 60 : 4;
    if (deckCardIds.length >= 60) { toast({ title: "Deck full", description: "Max 60 cards." }); return; }
    if (count >= limit) { toast({ title: "Copy limit", description: `Max ${limit} copies of ${card.name}.` }); return; }
    setDeckCardIds(prev => [...prev, card.id]);
  };

  const removeCard = (cardId) => {
    setDeckCardIds(prev => {
      const idx = prev.lastIndexOf(cardId);
      if (idx === -1) return prev;
      const next = [...prev]; next.splice(idx, 1); return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!deckName.trim()) throw new Error("Enter a deck name.");
      if (!deckCardIds.length) throw new Error("Add at least one card.");
      const lead = getCardById(deckCardIds[0]);
      const payload = {
        name: deckName.trim(), mode,
        card_ids: deckCardIds, card_count: deckCardIds.length,
        pokemon_count: stats.pokemon, trainer_count: stats.trainer, energy_count: stats.energy,
        cover_icon: (lead?.energy_type || "colorless"),
        cover_image: lead?.image_small || null, source: "hybrid",
      };
      return deckId ? db.entities.Deck.update(deckId, payload) : db.entities.Deck.create(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      toast({ title: "Deck saved" });
      navigate("/decks");
    },
    onError: (e) => toast({ title: "Save failed", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deckId ? db.entities.Deck.delete(deckId) : null,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["decks"] });
      toast({ title: "Deck deleted" });
      navigate("/decks");
    },
  });

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  const deckComplete = deckCardIds.length === 60;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate("/decks")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm flex-shrink-0">
              <ArrowLeft className="w-4 h-4" />
              Decks
            </button>
            <div className="h-4 w-px bg-border" />
            <Input
              value={deckName}
              onChange={e => setDeckName(e.target.value)}
              className="font-display font-bold text-base border-none bg-transparent p-0 h-auto focus-visible:ring-0 min-w-0 max-w-[200px]"
              placeholder="Deck name..."
            />
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className={`text-sm font-body font-semibold ${deckComplete ? "text-emerald-400" : deckCardIds.length >= 50 ? "text-yellow-400" : "text-muted-foreground"}`}>
              {deckCardIds.length}/60
              {deckComplete && <CheckCircle2 className="w-4 h-4 inline ml-1 text-emerald-400" />}
            </div>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-card text-sm font-body hover:bg-secondary transition-colors lg:hidden"
            >
              <Layers className="w-4 h-4" />
              Deck
            </button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} size="sm" className="font-body gap-1.5">
              {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </Button>
            {deckId && (
              <Button variant="outline" size="sm" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="font-body gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-5 flex gap-5">

        {/* Left: catalog */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Filters */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards…" className="pl-9 font-body" />
              </div>
              {isFetching && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
              <Badge variant="secondary" className="font-body">{cardResults?.source === "api" ? "Live" : "Local"}</Badge>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {FILTERS.map(f => (
                <button key={f} type="button" onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-body capitalize border transition-colors ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-secondary"}`}>
                  {f}
                </button>
              ))}
            </div>

            {/* Set pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {sets.map(set => (
                <button key={set.id} type="button" onClick={() => setSelectedSet(set.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-body transition-colors ${set.id === selectedSet ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary/60"}`}>
                  {set.images?.symbol && <img src={set.images.symbol} alt="" className="w-5 h-5 object-contain" />}
                  <span className="truncate max-w-[120px]">{set.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Mode */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-body text-muted-foreground uppercase tracking-widest">Mode</span>
            {[["unlimited", "Unlimited"], ["standard", "Standard"]].map(([v, l]) => (
              <button key={v} type="button" onClick={() => setMode(v)}
                className={`px-3 py-1 rounded-lg text-xs font-body border ${mode === v ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground"}`}>
                {l}
              </button>
            ))}
          </div>

          {/* Card grid */}
          {!selectedSet ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="font-body text-muted-foreground">Select an expansion above to browse cards.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
              <AnimatePresence mode="popLayout">
                {(cardResults?.cards || []).map((card, i) => (
                  <CardTile
                    key={card.id}
                    card={card}
                    inDeck={deckCounts[card.id] || 0}
                    onAdd={addCard}
                    onRemove={removeCard}
                    disabled={false}
                  />
                ))}
              </AnimatePresence>
              {(cardResults?.cards || []).length === 0 && !isFetching && (
                <div className="col-span-full rounded-2xl border border-dashed border-border p-10 text-center">
                  <p className="font-body text-muted-foreground">No cards found. Try a different search or filter.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar: deck list */}
        <div className={`
          w-72 flex-shrink-0 space-y-4
          max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-30 max-lg:w-80
          max-lg:bg-background max-lg:border-l max-lg:border-border max-lg:p-4 max-lg:overflow-y-auto
          max-lg:transition-transform max-lg:duration-200
          ${sidebarOpen ? "max-lg:translate-x-0" : "max-lg:translate-x-full"}
        `}>
          {/* close on mobile */}
          <div className="flex items-center justify-between lg:hidden">
            <p className="font-display font-bold text-lg">Deck List</p>
            <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-secondary">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-3 gap-2">
            {[["Pokémon", stats.pokemon], ["Trainer", stats.trainer], ["Energy", stats.energy]].map(([l, v]) => (
              <div key={l} className="rounded-xl border border-border bg-card p-2 text-center">
                
                <p className="font-display text-xl font-bold">{v}</p>
                <p className="text-[10px] font-body text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>

          {/* HP bar */}
          <div>
            <div className="flex items-center justify-between text-xs font-body text-muted-foreground mb-1">
              <span>Deck size</span>
              <span className={deckComplete ? "text-emerald-400 font-semibold" : ""}>{deckCardIds.length}/60</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${deckComplete ? "bg-emerald-500" : deckCardIds.length >= 50 ? "bg-yellow-500" : "bg-primary"}`}
                style={{ width: `${(deckCardIds.length / 60) * 100}%` }}
              />
            </div>
          </div>

          {/* Card list */}
          <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto">
            {selectedCards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <p className="text-xs font-body text-muted-foreground">Your deck is empty.<br />Tap + on any card to add.</p>
              </div>
            ) : (
              selectedCards.map(({ card, quantity }) => (
                <DeckSlotRow key={card.id} card={card} quantity={quantity} onRemove={removeCard} />
              ))
            )}
          </div>
        </div>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}
      </div>
    </div>
  );
}
