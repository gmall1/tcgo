import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Sparkles, Download, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import db from "@/lib/localDb";
import { TypeIcon } from "@/lib/typeIcons";
import {
  getCardById,
  getPokemonCards,
  getEnergyCards,
  getTrainerCards,
  registerCatalogCards,
  normalizeApiCardToCatalog,
} from "@/lib/cardCatalog";
import { buildAIDeck } from "@/lib/aiDeckBuilder";
import { fetchCardsByIds, searchCards } from "@/lib/pokemonTCGApi";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_KEY_STORAGE = "tcg_groq_api_key_v1";

const PERSONALITIES = [
  { id: "balanced", label: "Balanced", desc: "Mixed strategy, bench + energy balance" },
  { id: "aggressive", label: "Aggressive", desc: "High damage attackers, fast KO" },
  { id: "stall", label: "Stall", desc: "Defensive, high HP Pokémon, healing" },
  { id: "control", label: "Control", desc: "Status effects, disruption play" },
];

// Parse a pasted Limitless / PTCGO-style decklist:
//   Pokémon: 12
//   4 Charizard ex OBF 125
//   3 Pidgeot ex OBF 164
//   ...
//   Trainer: 30
//   ...
//   Energy: 18
//   15 Basic {R} Energy SVE 2
//
// Returns { lines: [{ qty, name, setCode, number }], total }.
// Unknown set code → best-effort name lookup via the API.
function parseLimitlessDecklist(raw) {
  const lines = [];
  const re = /^\s*(\d+)\s+(.+?)(?:\s+([A-Z0-9]{2,5}))?\s+(\d+)\s*$/;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(pok[eé]mon|trainer|energy)\s*[:\-]/i.test(trimmed)) continue;
    if (/^total\s*[:\-]/i.test(trimmed)) continue;
    const m = trimmed.match(re);
    if (!m) continue;
    const qty = Number(m[1]);
    if (!qty || qty > 60) continue;
    lines.push({ qty, name: m[2].trim(), setCode: m[3] || null, number: m[4] });
  }
  const total = lines.reduce((s, l) => s + l.qty, 0);
  return { lines, total };
}

// Map Limitless/PTCGO set codes → pokemontcg.io set ids. Keeps common sets;
// unknown codes fall through to name search.
const SET_CODE_MAP = {
  OBF: "sv3",
  PAL: "sv2",
  SVI: "sv1",
  MEW: "sv3pt5",
  PAR: "sv4",
  SVP: "svp",
  SVE: "sve",
  PGO: "pgo",
  BST: "swsh9",
  EVS: "swsh7",
  FST: "swsh8",
  VIV: "swsh4",
  SSH: "swsh1",
  BCR: "bw7",
  BS: "base1",
  BASE: "base1",
};

async function resolveDecklistToIds(parsed) {
  const ids = [];
  const missing = [];
  for (const line of parsed.lines) {
    const mapped = line.setCode ? SET_CODE_MAP[line.setCode.toUpperCase()] : null;
    let cardId = null;
    if (mapped) {
      cardId = `${mapped}-${line.number}`;
      try {
        const [card] = await fetchCardsByIds([cardId]);
        if (card) {
          registerCatalogCards([normalizeApiCardToCatalog(card)]);
          for (let i = 0; i < line.qty; i++) ids.push(cardId);
          continue;
        }
      } catch {
        // fall through to name search
      }
    }
    // Best-effort by name
    try {
      const { cards } = await searchCards(`name:"${line.name.replace(/"/g, "")}"`, 1, 1);
      const first = cards?.[0];
      if (first) {
        registerCatalogCards([normalizeApiCardToCatalog(first)]);
        for (let i = 0; i < line.qty; i++) ids.push(first.id);
        continue;
      }
    } catch {
      // ignore
    }
    missing.push(`${line.qty}× ${line.name} ${line.setCode || ""} ${line.number}`);
  }
  return { ids, missing };
}

export default function AIDeckBuilder() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [personality, setPersonality] = useState("balanced");
  const [deckName, setDeckName] = useState("");
  const [generatedCards, setGeneratedCards] = useState([]);
  const [generating, setGenerating] = useState(false);

  const [groqKey, setGroqKey] = useState(() => {
    try { return localStorage.getItem(GROQ_KEY_STORAGE) || ""; } catch { return ""; }
  });
  const [deckTheme, setDeckTheme] = useState("");

  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState([]);

  const saveGroqKey = (v) => {
    setGroqKey(v);
    try {
      if (v.trim()) localStorage.setItem(GROQ_KEY_STORAGE, v.trim());
      else localStorage.removeItem(GROQ_KEY_STORAGE);
    } catch { /* ignore quota errors */ }
  };

  const pool = useMemo(() => {
    const pokemon = getPokemonCards();
    const trainers = getTrainerCards();
    const energies = getEnergyCards();
    return { pokemon, trainers, energies };
  }, []);

  const quickGenerate = () => {
    const ids = buildAIDeck(personality);
    setGeneratedCards(ids);
    setImportWarnings([]);
    toast({ title: "Deck ready", description: `Offline ${personality} starter loaded.` });
  };

  const generateWithGroq = async () => {
    if (!deckName.trim()) {
      toast({ title: "Name required", description: "Give your AI deck a name." });
      return;
    }
    if (!groqKey.trim()) {
      toast({ title: "Groq key required", description: "Paste a free key from console.groq.com or use Quick Generate." });
      return;
    }
    setGenerating(true);
    setImportWarnings([]);
    try {
      const catalogSummary = [
        ...pool.pokemon.slice(0, 40),
        ...pool.trainers.slice(0, 20),
        ...pool.energies.slice(0, 16),
      ].map((c) => `- ${c.id} | ${c.name} | ${c.card_type}${c.card_type === "pokemon" ? ` (${c.energy_type}, ${c.hp}hp, stage=${c.stage})` : ""}`).join("\n");

      const prompt = `You are a Pokémon TCG deck designer. Build a legal 60-card deck from ONLY the cards in this catalog. Use each card's id. Respect the "4 copies max per non-basic-energy card" rule.

Personality: ${personality}
Theme: ${deckTheme || "(none)"}

Catalog:
${catalogSummary}

Output ONLY a valid JSON object in this exact shape (no prose, no markdown fences):
{"cards": [{"id": "base1-46", "count": 4}, ...]}

The counts must sum to exactly 60. At least 12 Pokémon. At most 4 of any non-energy card.`;

      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "You output ONLY valid JSON. No prose, no markdown." },
            { role: "user", content: prompt },
          ],
          temperature: 0.4,
          max_tokens: 1800,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Groq ${response.status}: ${err.slice(0, 140)}`);
      }
      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content || "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\{[\s\S]*\}/);
        parsed = match ? JSON.parse(match[0]) : { cards: [] };
      }
      const cards = Array.isArray(parsed.cards) ? parsed.cards : [];
      const ids = [];
      const warnings = [];
      for (const entry of cards) {
        const c = getCardById(entry.id);
        if (!c) {
          warnings.push(`Unknown id: ${entry.id}`);
          continue;
        }
        const n = Math.max(1, Math.min(Number(entry.count) || 1, 4));
        for (let i = 0; i < n; i++) ids.push(entry.id);
      }
      if (ids.length < 40) {
        warnings.push("Deck under 40 cards, padding with basic energies.");
        const energies = pool.energies.slice(0, 4);
        while (ids.length < 60 && energies.length) ids.push(energies[ids.length % energies.length].id);
      }
      setGeneratedCards(ids.slice(0, 60));
      setImportWarnings(warnings);
      toast({ title: "Groq deck ready", description: `${ids.length} cards generated.` });
    } catch (e) {
      toast({ title: "Groq generation failed", description: e.message });
    } finally {
      setGenerating(false);
    }
  };

  const importDecklist = async () => {
    if (!importText.trim()) {
      toast({ title: "Paste a decklist", description: "Use Limitless format (qty name SET num)." });
      return;
    }
    setImporting(true);
    setImportWarnings([]);
    try {
      const parsed = parseLimitlessDecklist(importText);
      if (!parsed.lines.length) {
        toast({ title: "No cards parsed", description: "Check the format." });
        return;
      }
      const { ids, missing } = await resolveDecklistToIds(parsed);
      setGeneratedCards(ids);
      setImportWarnings(missing.map((m) => `Could not resolve: ${m}`));
      if (!deckName.trim()) setDeckName(`Imported deck (${parsed.total})`);
      toast({ title: "Decklist imported", description: `${ids.length}/${parsed.total} cards resolved.` });
    } catch (e) {
      toast({ title: "Import failed", description: e.message });
    } finally {
      setImporting(false);
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

      await db.entities.Deck.create({
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
    .filter((e) => e.card);

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
              onChange={(e) => setDeckName(e.target.value)}
              placeholder="e.g., Fire Blitz, Water Control..."
              className="font-display font-bold text-base"
            />
          </div>

          <div>
            <label className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-3 block">Personality</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PERSONALITIES.map((p) => (
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

          <div>
            <label className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2 block">Deck theme (optional)</label>
            <Input
              value={deckTheme}
              onChange={(e) => setDeckTheme(e.target.value)}
              placeholder="e.g., Base Set fire attackers, Pikachu spread, mill control…"
              className="font-body text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2 block">Groq API key (stored locally only)</label>
            <Input
              type="password"
              value={groqKey}
              onChange={(e) => saveGroqKey(e.target.value)}
              placeholder="gsk_…"
              className="font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Free at <a href="https://console.groq.com" target="_blank" rel="noreferrer" className="text-primary underline">console.groq.com</a>. Key never leaves your browser.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={generateWithGroq}
              disabled={generating}
              className="flex-1 font-body gap-2"
            >
              {generating ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Asking Groq…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Generate with Groq</>
              )}
            </Button>
            <Button
              onClick={quickGenerate}
              variant="outline"
              className="flex-1 font-body gap-2"
            >
              Quick offline deck
            </Button>
          </div>
        </div>

        {/* Limitless decklist import */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-4 h-4 text-primary" />
            <p className="font-display font-bold text-base">Import from Limitless TCG</p>
          </div>
          <p className="text-xs font-body text-muted-foreground">
            Paste any <a href="https://limitlesstcg.com/decks" target="_blank" rel="noreferrer" className="text-primary underline">limitlesstcg.com</a> or PTCGO-format decklist (<code>4 Charizard ex OBF 125</code>). Cards are resolved against the official Pokémon TCG API.
          </p>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Pokémon: 12&#10;4 Charizard ex OBF 125&#10;…&#10;Energy: 18&#10;15 Basic Fire Energy SVE 2"
            rows={6}
            className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background font-mono resize-y"
          />
          <Button
            onClick={importDecklist}
            disabled={importing}
            variant="outline"
            className="w-full font-body gap-2"
          >
            {importing ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Resolving…</>
            ) : (
              <><Download className="w-4 h-4" /> Import decklist</>
            )}
          </Button>
          {importWarnings.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1 max-h-32 overflow-y-auto">
              {importWarnings.map((w, i) => (
                <p key={i} className="text-[11px] font-body text-amber-400">{w}</p>
              ))}
            </div>
          )}
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
