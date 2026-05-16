import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Save, Bot, Shuffle, Sparkles, Music, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { TypeIcon } from "@/lib/typeIcons";
import { getTypeStyle, getPokemonCards, getEnergyCards, buildStarterDeck, getCardById } from "@/lib/cardCatalog";

const ADMIN_KEY = "tcg_admin_config_v1";

function readAdminConfig() {
  try {
    const raw = localStorage.getItem(ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeAdminConfig(cfg) {
  try { localStorage.setItem(ADMIN_KEY, JSON.stringify(cfg)); } catch {}
}

const DEFAULT_AI_DECKS = [
  {
    id: "ai-aggressive",
    name: "Sparky Aggressive",
    personality: "aggressive",
    description: "All-out attacking strategy with high-damage Pokémon",
    cardIds: buildStarterDeck(),
  },
  {
    id: "ai-balanced",
    name: "Sparky Balanced",
    personality: "balanced",
    description: "Mixed strategy with bench setup and trainer support",
    cardIds: buildStarterDeck().slice().reverse(),
  },
  {
    id: "ai-stall",
    name: "Sparky Stall",
    personality: "stall",
    description: "Defensive play, lots of trainers and healing",
    cardIds: buildStarterDeck(),
  },
];

const PERSONALITY_LABELS = {
  aggressive: { label: "Aggressive", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  balanced:   { label: "Balanced",   color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  stall:      { label: "Stall",      color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

function CardMiniTile({ card, onRemove }) {
  const style = getTypeStyle(card.energy_type || "colorless");
  const img = card.image_small || card.imageSmall;
  return (
    <div className="relative group flex-shrink-0">
      <div className={`w-12 h-16 rounded-lg overflow-hidden bg-gradient-to-br ${style.bg} flex items-center justify-center border border-border`}>
        {img ? <img src={img} alt={card.name} className="w-full h-full object-cover" loading="lazy" />
          : <TypeIcon type={card.energy_type || "colorless"} size={18} />}
      </div>
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] transition-opacity"
        >
          ×
        </button>
      )}
    </div>
  );
}

function AIDeckEditor({ deck, onSave }) {
  const [name, setName] = useState(deck.name);
  const [personality, setPersonality] = useState(deck.personality);
  const [description, setDescription] = useState(deck.description || "");
  const [cardIds, setCardIds] = useState(deck.cardIds || []);
  const [search, setSearch] = useState("");
  const [dirty, setDirty] = useState(false);

  const allPokemon = getPokemonCards().slice(0, 40);
  const allEnergy = getEnergyCards();

  const filtered = allPokemon.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  );

  const counts = cardIds.reduce((a, id) => { a[id] = (a[id] || 0) + 1; return a; }, {});

  const add = (id) => {
    if (cardIds.length >= 60) return;
    setCardIds(p => [...p, id]);
    setDirty(true);
  };
  const remove = (id) => {
    setCardIds(p => { const i = p.lastIndexOf(id); if (i === -1) return p; const n = [...p]; n.splice(i, 1); return n; });
    setDirty(true);
  };
  const randomize = () => {
    const basics = allPokemon.filter(c => c.stage === "basic").slice(0, 6);
    const energy = allEnergy.slice(0, 2);
    const ids = [];
    basics.forEach(c => { for (let i = 0; i < 4; i++) ids.push(c.id); });
    while (ids.length < 60 && energy.length) ids.push(energy[ids.length % energy.length].id);
    setCardIds(ids.slice(0, 60));
    setDirty(true);
  };

  const handleSave = () => {
    onSave({ ...deck, name, personality, description, cardIds });
    setDirty(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <Input value={name} onChange={e => { setName(e.target.value); setDirty(true); }} className="font-display font-bold text-base h-8" />
          <div className="flex items-center gap-2 flex-wrap">
            {Object.entries(PERSONALITY_LABELS).map(([k, v]) => (
              <button key={k} onClick={() => { setPersonality(k); setDirty(true); }}
                className={`px-2.5 py-1 rounded-full text-xs font-body border transition-all ${personality === k ? v.color + " border" : "border-border text-muted-foreground hover:bg-secondary"}`}>
                {v.label}
              </button>
            ))}
          </div>
          <Input value={description} onChange={e => { setDescription(e.target.value); setDirty(true); }} placeholder="Description…" className="font-body text-xs h-7" />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={randomize} className="font-body gap-1.5 text-xs h-7">
            <Shuffle className="w-3 h-3" /> Random
          </Button>
          {dirty && (
            <Button size="sm" onClick={handleSave} className="font-body gap-1.5 text-xs h-7">
              <Save className="w-3 h-3" /> Save
            </Button>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-body text-muted-foreground">Deck: {cardIds.length}/60 cards</p>
        </div>
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden mb-2">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(cardIds.length/60)*100}%` }} />
        </div>
        <div className="flex gap-1.5 flex-wrap max-h-24 overflow-y-auto">
          {Object.entries(counts).map(([id, qty]) => {
            const c = getCardById(id);
            if (!c) return null;
            return (
              <div key={id} className="flex items-center gap-1 bg-secondary rounded-lg px-2 py-0.5 text-xs font-body">
                <span className="truncate max-w-[80px]">{c.name}</span>
                <Badge variant="outline" className="text-[10px] px-1 py-0">×{qty}</Badge>
                <button onClick={() => remove(id)} className="text-muted-foreground hover:text-destructive ml-0.5">×</button>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cards to add…" className="pl-8 font-body h-7 text-xs" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
          {filtered.slice(0, 30).map(c => {
            const s = getTypeStyle(c.energy_type || "colorless");
            const cnt = counts[c.id] || 0;
            return (
              <button key={c.id} onClick={() => add(c.id)} disabled={cardIds.length >= 60}
                className="flex items-center gap-2 p-2 rounded-xl border border-border bg-background hover:bg-secondary/50 transition-colors text-left">
                <div className={`w-8 h-11 rounded-lg bg-gradient-to-br ${s.bg} flex-shrink-0 flex items-center justify-center text-sm overflow-hidden`}>
                  {c.image_small ? <img src={c.image_small} alt="" className="w-full h-full object-cover" loading="lazy" /> : <TypeIcon type={c.energy_type || "colorless"} size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-body font-semibold truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">{c.energy_type}</p>
                  {cnt > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0">×{cnt}</Badge>}
                </div>
              </button>
            );
          })}
          {/* energy cards */}
          {!search && allEnergy.slice(0, 8).map(c => {
            const s = getTypeStyle(c.energy_type || "colorless");
            const cnt = counts[c.id] || 0;
            return (
              <button key={c.id} onClick={() => add(c.id)} disabled={cardIds.length >= 60}
                className="flex items-center gap-2 p-2 rounded-xl border border-border bg-background hover:bg-secondary/50 transition-colors text-left">
                <div className={`w-8 h-11 rounded-lg bg-gradient-to-br ${s.bg} flex-shrink-0 flex items-center justify-center`}><TypeIcon type={c.energy_type || "colorless"} size={18} /></div>
                <div className="min-w-0">
                  <p className="text-xs font-body font-semibold truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">Energy</p>
                  {cnt > 0 && <Badge variant="secondary" className="text-[10px] px-1 py-0">×{cnt}</Badge>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tab, setTab] = useState("ai");
  const [aiDecks, setAiDecks] = useState(() => {
    const cfg = readAdminConfig();
    return cfg?.aiDecks || DEFAULT_AI_DECKS;
  });
  const [saved, setSaved] = useState(false);

  const saveAll = () => {
    writeAdminConfig({ aiDecks, savedAt: Date.now() });
    setSaved(true);
    toast({ title: "Admin config saved", description: "Changes will apply on next app reload." });
    setTimeout(() => setSaved(false), 2000);
  };

  const updateAiDeck = (updated) => {
    setAiDecks(prev => prev.map(d => d.id === updated.id ? updated : d));
  };

  const TABS = [
    { id: "ai", label: "AI Decks", icon: <Bot className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-background pb-16">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm">
              <ArrowLeft className="w-4 h-4" /> Home
            </button>
            <div className="h-4 w-px bg-border" />
            <p className="font-display font-bold text-base">Admin Panel</p>
            <Badge variant="outline" className="font-body text-xs">Local config</Badge>
          </div>
          <Button onClick={saveAll} size="sm" className="font-body gap-1.5">
            {saved ? <><span className="text-emerald-400">✓</span> Saved</> : <><Save className="w-3.5 h-3.5" /> Save all</>}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-5 space-y-5">
        {/* Info banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-body text-amber-400 font-semibold">Admin — local storage only</p>
          <p className="text-xs font-body text-amber-400/75 mt-1">
            Changes here override the default card data and AI deck lists stored in your browser.
            Hit "Save all" to persist. These configs survive page reloads but clear if you clear site data.
          </p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 border-b border-border pb-1 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-t-xl text-sm font-body transition-colors border-b-2 flex-shrink-0 ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Quick tools section */}
        <div className="mt-5 space-y-3">
          <p className="text-sm font-display font-bold uppercase tracking-widest text-muted-foreground">Quick Tools</p>
          <div className="grid grid-cols-2 gap-3">
            <Link to="/pack-shop">
              <div className="rounded-xl border border-border bg-card p-4 hover:bg-secondary/60 transition-colors flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-body font-semibold text-sm">Pack Shop</p>
                  <p className="text-[11px] text-muted-foreground">Open boosters and inspect pulls</p>
                </div>
              </div>
            </Link>
            <Link to="/sound-admin">
              <div className="rounded-xl border border-border bg-card p-4 hover:bg-secondary/60 transition-colors flex items-start gap-3">
                <Music className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-body font-semibold text-sm">Sound Settings</p>
                  <p className="text-[11px] text-muted-foreground">Manage game audio</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* AI decks tab */}
        {tab === "ai" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="font-display font-bold text-base mb-1">AI deck configurations</p>
              <p className="text-sm font-body text-muted-foreground mb-4">
                Each AI personality uses one of these decks. Editing the card list here changes what the AI plays in battle.
                Personality affects strategy (aggressive/balanced/stall) — the deck composition reinforces it.
              </p>
              <div className="space-y-4">
                {aiDecks.map(deck => (
                  <AIDeckEditor key={deck.id} deck={deck} onSave={updateAiDeck} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
