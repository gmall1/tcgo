import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Code,
  Copy,
  Plus,
  Save,
  Trash2,
  X,
  CheckCircle2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import BottomNav from "@/components/tcg/BottomNav";
import PageHeader from "@/components/tcg/PageHeader";
import { fetchCatalogCards } from "@/lib/cardCatalog";
import {
  PRIMITIVES,
  GUARDS,
  PARAM_TYPES,
  PRIMITIVE_CATEGORIES,
  getPrimitiveById,
  getGuardById,
} from "@/lib/mechanicPrimitives";
import {
  saveConfig,
  deleteConfig,
  getConfigsForCard,
  generateCodeForConfig,
} from "@/lib/cardMechanicConfigs";

const ENERGY_TYPE_OPTIONS = [
  "Fire", "Water", "Grass", "Lightning", "Psychic", "Fighting",
  "Darkness", "Metal", "Dragon", "Fairy", "Colorless",
];
const STATUS_OPTIONS = ["poisoned", "burned", "asleep", "paralyzed", "confused"];

function defaultParams(schema = []) {
  const out = {};
  for (const p of schema) {
    if (p.default !== undefined) out[p.key] = p.default;
    else if (p.type === PARAM_TYPES.number) out[p.key] = 0;
    else if (p.type === PARAM_TYPES.bool) out[p.key] = false;
    else out[p.key] = "";
  }
  return out;
}

function ParamInput({ schema, value, onChange }) {
  const v = value ?? schema.default ?? "";
  if (schema.type === PARAM_TYPES.number) {
    return (
      <Input
        type="number"
        value={v}
        min={schema.min}
        max={schema.max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-24 bg-zinc-800 border-zinc-700 text-white"
      />
    );
  }
  if (schema.type === PARAM_TYPES.bool) {
    return (
      <input
        type="checkbox"
        checked={Boolean(v)}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-cyan-400"
      />
    );
  }
  // dropdowns
  let options = schema.options || [];
  if (schema.type === PARAM_TYPES.energyType && !options.length) options = ENERGY_TYPE_OPTIONS;
  if (schema.type === PARAM_TYPES.status && !options.length) options = STATUS_OPTIONS;
  if (options.length) {
    return (
      <select
        value={v}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded bg-zinc-800 border border-zinc-700 text-white px-2 text-sm"
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    );
  }
  return (
    <Input
      type="text"
      value={v}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-32 bg-zinc-800 border-zinc-700 text-white"
    />
  );
}

function PrimitiveCard({ entry, primDef, onChange, onRemove }) {
  if (!primDef) return null;
  const guards = entry.guards || [];

  function patchParam(k, val) {
    onChange({ ...entry, params: { ...(entry.params || {}), [k]: val } });
  }
  function addGuard(guardId) {
    const guardDef = getGuardById(guardId);
    if (!guardDef) return;
    onChange({
      ...entry,
      guards: [...guards, { id: guardId, params: defaultParams(guardDef.params) }],
    });
  }
  function patchGuardParam(idx, k, val) {
    const next = guards.slice();
    next[idx] = { ...next[idx], params: { ...(next[idx].params || {}), [k]: val } };
    onChange({ ...entry, guards: next });
  }
  function removeGuard(idx) {
    onChange({ ...entry, guards: guards.filter((_, i) => i !== idx) });
  }

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/60 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-cyan-300">{primDef.label}</div>
          <div className="text-xs text-zinc-400">{primDef.description}</div>
        </div>
        <Button size="icon" variant="ghost" onClick={onRemove} className="h-7 w-7 text-zinc-400 hover:text-red-400">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {primDef.params?.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {primDef.params.map((schema) => (
            <label key={schema.key} className="flex items-center gap-2 text-xs text-zinc-300">
              <span className="capitalize">{schema.key}</span>
              <ParamInput
                schema={schema}
                value={entry.params?.[schema.key]}
                onChange={(val) => patchParam(schema.key, val)}
              />
            </label>
          ))}
        </div>
      )}
      <div className="space-y-1">
        {guards.length > 0 && (
          <div className="space-y-1">
            {guards.map((g, idx) => {
              const def = getGuardById(g.id);
              if (!def) return null;
              return (
                <div key={`${g.id}-${idx}`} className="flex flex-wrap items-center gap-2 rounded bg-zinc-950/60 border border-zinc-800 px-2 py-1">
                  <Badge variant="outline" className="border-amber-500/50 text-amber-300 text-[11px]">guard</Badge>
                  <span className="text-xs text-zinc-200">{def.label}</span>
                  {def.params?.map((schema) => (
                    <label key={schema.key} className="flex items-center gap-1 text-[11px] text-zinc-300">
                      <span className="capitalize">{schema.key}</span>
                      <ParamInput
                        schema={schema}
                        value={g.params?.[schema.key]}
                        onChange={(val) => patchGuardParam(idx, schema.key, val)}
                      />
                    </label>
                  ))}
                  <Button size="icon" variant="ghost" onClick={() => removeGuard(idx)} className="h-6 w-6 text-zinc-400 hover:text-red-400 ml-auto">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <select
          value=""
          onChange={(e) => { if (e.target.value) addGuard(e.target.value); }}
          className="text-[11px] bg-zinc-800 border border-zinc-700 text-zinc-200 rounded px-2 py-1"
        >
          <option value="">+ Add guard…</option>
          {GUARDS.map((g) => (
            <option key={g.id} value={g.id}>{g.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function MechanicBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cards, setCards] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [attackName, setAttackName] = useState("*");
  const [primitives, setPrimitives] = useState([]);
  const [paletteCategory, setPaletteCategory] = useState(PRIMITIVE_CATEGORIES[0]);
  const [savedConfigs, setSavedConfigs] = useState([]);
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadCatalog() {
      try {
        const res = await fetchCatalogCards({ pageSize: 200 });
        if (cancelled) return;
        const pokemon = (res.cards || []).filter((c) => c.card_type === "pokemon");
        setCards(pokemon);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCatalog();
    return () => { cancelled = true; };
  }, []);

  const selectedCard = useMemo(
    () => cards.find((c) => c.id === selectedCardId) || null,
    [cards, selectedCardId]
  );

  const filteredCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return cards.slice(0, 60);
    return cards.filter((c) => c.name?.toLowerCase().includes(q)).slice(0, 60);
  }, [cards, search]);

  // Reload saved configs whenever the selected card changes.
  useEffect(() => {
    if (!selectedCardId) {
      setSavedConfigs([]);
      return;
    }
    setSavedConfigs(getConfigsForCard(selectedCardId));
  }, [selectedCardId]);

  function loadConfigIntoEditor(config) {
    setAttackName(config.attackName || "*");
    setPrimitives(JSON.parse(JSON.stringify(config.primitives || [])));
  }

  function selectCard(cardId) {
    setSelectedCardId(cardId);
    setAttackName("*");
    setPrimitives([]);
  }

  function addPrimitive(primId) {
    const def = getPrimitiveById(primId);
    if (!def) return;
    setPrimitives((prev) => [...prev, {
      id: primId,
      params: defaultParams(def.params),
      guards: [],
    }]);
  }

  function patchPrimitive(idx, next) {
    setPrimitives((prev) => prev.map((e, i) => (i === idx ? next : e)));
  }
  function removePrimitive(idx) {
    setPrimitives((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    if (!selectedCard) {
      toast({ title: "Pick a card first", variant: "destructive" });
      return;
    }
    if (!primitives.length) {
      toast({ title: "Add at least one mechanic", variant: "destructive" });
      return;
    }
    const config = {
      cardId: selectedCard.id,
      cardName: selectedCard.name,
      attackName: attackName || "*",
      primitives,
      enabled: true,
    };
    saveConfig(config);
    setSavedConfigs(getConfigsForCard(selectedCard.id));
    toast({
      title: "Mechanic saved",
      description: `${selectedCard.name} → ${attackName || "(any attack)"}`,
    });
  }

  function handleDelete(config) {
    deleteConfig(config.cardId, config.attackName);
    setSavedConfigs(getConfigsForCard(selectedCard.id));
    toast({ title: "Mechanic removed" });
  }

  const generatedCode = useMemo(() => {
    if (!selectedCard) return "";
    return generateCodeForConfig({
      cardId: selectedCard.id,
      cardName: selectedCard.name,
      attackName: attackName || "*",
      primitives,
    });
  }, [selectedCard, attackName, primitives]);

  const palette = useMemo(
    () => PRIMITIVES.filter((p) => p.category === paletteCategory),
    [paletteCategory]
  );

  const attackOptions = useMemo(() => {
    if (!selectedCard) return [];
    const names = new Set(["*"]);
    for (const a of selectedCard.attacks || []) {
      if (a?.name) names.add(a.name);
    }
    if (selectedCard.attack1_name) names.add(selectedCard.attack1_name);
    if (selectedCard.attack2_name) names.add(selectedCard.attack2_name);
    return [...names];
  }, [selectedCard]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-24">
      <PageHeader title="Mechanic Builder" />

      <div className="px-3 pt-2 pb-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-zinc-300" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="text-xs text-zinc-400">
          Visual editor — pick a card, chain primitives + guards, save to install live.
        </div>
      </div>

      <div className="px-3 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3">
        {/* LEFT: card picker + saved configs */}
        <div className="space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="text-xs uppercase text-zinc-400 mb-2">Card</div>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2 h-4 w-4 text-zinc-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Pokémon"
                className="h-8 pl-8 bg-zinc-800 border-zinc-700 text-white"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-1">
              {loading && <div className="text-xs text-zinc-500">Loading catalog…</div>}
              {!loading && filteredCards.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCard(c.id)}
                  className={`w-full flex items-center gap-2 rounded px-2 py-1 text-left text-xs ${
                    selectedCardId === c.id
                      ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                      : "bg-zinc-800/40 text-zinc-200 hover:bg-zinc-800/80 border border-transparent"
                  }`}
                >
                  {c.image_small && (
                    <img src={c.image_small} alt="" className="h-8 w-6 object-cover rounded-sm" />
                  )}
                  <div className="flex-1 truncate">
                    <div className="truncate">{c.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{c.set_name || c.set_id}</div>
                  </div>
                </button>
              ))}
              {!loading && !filteredCards.length && (
                <div className="text-xs text-zinc-500">No matches.</div>
              )}
            </div>
          </div>

          {selectedCard && savedConfigs.length > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
              <div className="text-xs uppercase text-zinc-400 mb-2">Saved for this card</div>
              <div className="space-y-1">
                {savedConfigs.map((c) => (
                  <div
                    key={`${c.cardId}-${c.attackName}`}
                    className="flex items-center justify-between gap-2 rounded bg-zinc-800/60 border border-zinc-700 px-2 py-1"
                  >
                    <button
                      className="flex-1 text-left text-xs text-cyan-200 hover:underline"
                      onClick={() => loadConfigIntoEditor(c)}
                    >
                      {c.attackName === "*" ? "(any attack)" : c.attackName}
                      <span className="ml-1 text-[10px] text-zinc-500">
                        × {c.primitives?.length || 0}
                      </span>
                    </button>
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(c)} className="h-6 w-6 text-zinc-400 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: editor */}
        <div className="space-y-3">
          {!selectedCard && (
            <div className="rounded-lg border border-dashed border-zinc-700 p-8 text-center text-sm text-zinc-400">
              Select a card on the left to begin building mechanics.
            </div>
          )}

          {selectedCard && (
            <>
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 flex items-start gap-3">
                {selectedCard.image_small && (
                  <img src={selectedCard.image_small} alt="" className="h-20 w-14 rounded object-cover" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-base font-semibold">{selectedCard.name}</div>
                  <div className="text-xs text-zinc-400">
                    {selectedCard.set_name || selectedCard.set_id}{" "}
                    {selectedCard.hp ? `• HP ${selectedCard.hp}` : ""}{" "}
                    {selectedCard.energy_type ? `• ${selectedCard.energy_type}` : ""}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-zinc-400">Attack:</span>
                    <select
                      value={attackName}
                      onChange={(e) => setAttackName(e.target.value)}
                      className="h-8 rounded bg-zinc-800 border border-zinc-700 text-white px-2 text-sm"
                    >
                      {attackOptions.map((n) => (
                        <option key={n} value={n}>{n === "*" ? "(any attack)" : n}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleSave} className="bg-cyan-500 hover:bg-cyan-400 text-black">
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCode((v) => !v)}>
                    <Code className="h-4 w-4 mr-1" /> {showCode ? "Hide" : "Code"}
                  </Button>
                </div>
              </div>

              {/* Primitives palette */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex flex-wrap gap-1 mb-2">
                  {PRIMITIVE_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setPaletteCategory(cat)}
                      className={`text-[11px] px-2 py-1 rounded border ${
                        paletteCategory === cat
                          ? "bg-cyan-500/20 text-cyan-200 border-cyan-500/40"
                          : "bg-zinc-800/40 text-zinc-300 border-zinc-700 hover:bg-zinc-800/80"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {palette.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => addPrimitive(p.id)}
                      className="flex items-center gap-2 rounded border border-zinc-700 bg-zinc-800/40 hover:bg-zinc-800/80 px-2 py-2 text-left text-xs"
                    >
                      <Plus className="h-3 w-3 text-cyan-300" />
                      <div className="min-w-0">
                        <div className="font-medium text-zinc-100">{p.label}</div>
                        <div className="text-[10px] text-zinc-500 truncate">{p.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Active primitives chain */}
              <div className="space-y-2">
                {primitives.length === 0 && (
                  <div className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-xs text-zinc-500">
                    Pick a primitive from the palette above to add it to the chain.
                  </div>
                )}
                {primitives.map((entry, idx) => (
                  <motion.div
                    key={`${entry.id}-${idx}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <PrimitiveCard
                      entry={entry}
                      primDef={getPrimitiveById(entry.id)}
                      onChange={(next) => patchPrimitive(idx, next)}
                      onRemove={() => removePrimitive(idx)}
                    />
                  </motion.div>
                ))}
              </div>

              {showCode && (
                <div className="rounded-lg border border-zinc-800 bg-black p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-zinc-400">Generated registration</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard?.writeText(generatedCode);
                        toast({ title: "Copied" });
                      }}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Copy
                    </Button>
                  </div>
                  <pre className="text-[11px] text-emerald-300 overflow-x-auto whitespace-pre-wrap">
{generatedCode}
                  </pre>
                  <div className="mt-2 text-[10px] text-zinc-500 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    Saved configs auto-register on app boot — you don't need to copy this anywhere.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
