import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Layers, Loader2, Search, SlidersHorizontal } from "lucide-react";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchCatalogCards, fetchExpansionSetsCached, getTypeStyle } from "@/lib/cardCatalog";
import { TypeIcon, TypeDot, TYPE_META } from "@/lib/typeIcons";

const SUPERTYPES = ["all", "pokemon", "trainer", "energy"];
const TYPES = ["all","fire","water","grass","lightning","psychic","fighting","darkness","metal","dragon","fairy","colorless"];

export default function Collection() {
  const [search, setSearch] = useState("");
  const [superFilter, setSuperFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedSet, setSelectedSet] = useState("");
  const [showTypeBar, setShowTypeBar] = useState(false);

  const { data: sets = [], isLoading: setsLoading } = useQuery({
    queryKey: ["expansion-sets"],
    queryFn: () => fetchExpansionSetsCached(),
    staleTime: 1000 * 60 * 60,
  });

  useEffect(() => {
    if (!selectedSet && sets.length > 0) setSelectedSet(sets[0].id);
  }, [selectedSet, sets]);

  const activeSet = useMemo(() => sets.find(s => s.id === selectedSet) || null, [selectedSet, sets]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["catalog-cards", search, superFilter, selectedSet],
    queryFn: () => fetchCatalogCards({ search, filter: superFilter, setId: selectedSet, page: 1, pageSize: 48 }),
    enabled: Boolean(selectedSet),
    staleTime: 1000 * 60 * 10,
  });

  // client-side type filter on top of API results
  const cards = useMemo(() => {
    const base = data?.cards || [];
    if (typeFilter === "all") return base;
    return base.filter(c => {
      const et = (c.energy_type || "").toLowerCase();
      const types = (c.types || []).map(t => t.toLowerCase());
      const tf = typeFilter.toLowerCase();
      return et === tf || types.includes(tf) || (tf === "lightning" && (et === "electric" || types.includes("electric")));
    });
  }, [data, typeFilter]);

  const sourceLabel = data?.source === "api" ? "Live API" : "Local";

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="px-4 pt-8 space-y-5">
        <PageHeader
          title="CARD DEX"
          subtitle={activeSet ? `${data?.totalCount || cards.length} cards — ${activeSet.name}` : "Browse expansions"}
        />

        {/* Search + filter row */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards..." className="pl-9 font-body" />
            </div>
            <button
              onClick={() => setShowTypeBar(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-body transition-colors ${showTypeBar ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary"}`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Filter
            </button>
            <Badge variant="secondary" className="font-body flex-shrink-0">{sourceLabel}</Badge>
            {isFetching && <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />}
          </div>

          {/* Supertype pills */}
          <div className="flex gap-2 flex-wrap">
            {SUPERTYPES.map(f => (
              <button key={f} onClick={() => setSuperFilter(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-body capitalize border transition-colors ${superFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-secondary"}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Type filter bar */}
          {showTypeBar && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex gap-2 flex-wrap pt-1">
              {TYPES.map(t => {
                const meta = TYPE_META[t] || TYPE_META.colorless;
                const active = typeFilter === t;
                return (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-body capitalize transition-all ${active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:bg-secondary"}`}>
                    {t !== "all" && <TypeIcon type={t} size={14} />}
                    {t}
                  </button>
                );
              })}
            </motion.div>
          )}
        </div>

        {/* Expansion set scroll */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-display text-base font-bold">Expansions</h2>
          </div>
          {setsLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none">
              {sets.map(set => {
                const sel = set.id === selectedSet;
                return (
                  <button key={set.id} onClick={() => setSelectedSet(set.id)}
                    className={`min-w-[180px] rounded-xl border p-3 text-left transition-colors flex-shrink-0 ${sel ? "border-primary bg-primary/10" : "border-border bg-card hover:bg-secondary/60"}`}>
                    <div className="flex items-center gap-2 min-w-0">
                      {set.images?.symbol && <img src={set.images.symbol} alt="" className="w-8 h-8 object-contain flex-shrink-0" />}
                      <div className="min-w-0">
                        <p className="font-body font-semibold text-sm truncate">{set.name}</p>
                        <p className="text-[11px] text-muted-foreground font-body truncate">{set.series || "—"}</p>
                        <p className="text-[10px] text-muted-foreground font-body mt-0.5">{set.total || "—"} cards · {set.releaseDate || "—"}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Card grid */}
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-body text-muted-foreground">
                {activeSet ? `${cards.length} cards${typeFilter !== "all" ? ` · ${typeFilter}` : ""}${search ? ` matching "${search}"` : ""}` : "Select an expansion."}
              </p>
            </div>

            {cards.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-10 text-center">
                <p className="font-display text-lg font-bold">No cards found</p>
                <p className="text-sm font-body text-muted-foreground mt-2">Try a different search or filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {cards.map((card, i) => <CollectionCard key={card.id} card={card} index={i} />)}
              </div>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}

function CollectionCard({ card, index }) {
  const typeKey = (card.energy_type || "colorless").toLowerCase();
  const meta = TYPE_META[typeKey] || TYPE_META.colorless;
  const imageUrl = card.image_small || card.image_large;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.02, 0.2) }}
      className="rounded-2xl border border-border bg-card overflow-hidden"
    >
      <div className="aspect-[5/7] bg-background/50 relative overflow-hidden">
        {imageUrl ? (
          <img src={imageUrl} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${meta.bg} flex items-center justify-center`}>
            <TypeIcon type={typeKey} size={48} />
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div>
          <p className="text-sm font-display font-bold leading-tight">{card.name}</p>
          <p className="text-[11px] text-muted-foreground font-body mt-0.5">{card.set_name || "Local"}</p>
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="capitalize text-[10px] px-1.5 py-0">{card.card_type}</Badge>
          {card.energy_type && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-border bg-background text-[10px] font-body capitalize">
              <TypeIcon type={card.energy_type} size={10} />
              {card.energy_type}
            </span>
          )}
          {card.stage && <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0">{card.stage}</Badge>}
          {card.rarity && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{String(card.rarity).replace(/_/g, " ")}</Badge>}
        </div>

        {card.card_type === "pokemon" ? (
          <div className="text-[11px] font-body text-muted-foreground space-y-0.5">
            <p>HP {card.hp || "—"}</p>
            {card.attack1_name && <p>{card.attack1_name} — {card.attack1_damage || 0}</p>}
            {card.attack2_name && <p>{card.attack2_name} — {card.attack2_damage || 0}</p>}
          </div>
        ) : (
          <p className="text-[11px] font-body text-muted-foreground line-clamp-2">{card.description || "—"}</p>
        )}
      </div>
    </motion.div>
  );
}
