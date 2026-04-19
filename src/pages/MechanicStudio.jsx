import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Zap,
  Code,
  Play,
  Pause,
  Download,
  Check,
  X,
  Eye,
  Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import BottomNav from "@/components/tcg/BottomNav";
import { fetchCatalogCards } from "@/lib/cardCatalog";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export default function MechanicStudio() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const containerRef = useRef(null);

  // State
  const [stage, setStage] = useState("setup"); // setup, scanning, generating, testing, complete
  const [groqKey, setGroqKey] = useState("");
  const [cardsPerBatch, setCardsPerBatch] = useState(50);
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);

  // Scanning data
  const [scannedCards, setScannedCards] = useState([]);
  const [extractedAttacks, setExtractedAttacks] = useState([]);
  const [scanProgress, setScanProgress] = useState(0);

  // Generation data
  const [generatedMechanics, setGeneratedMechanics] = useState([]);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [selectedMechanic, setSelectedMechanic] = useState(null);

  // Testing
  const [testBattle, setTestBattle] = useState(null);
  const [testLog, setTestLog] = useState([]);

  // Logs
  const [logs, setLogs] = useState([]);

  const addLog = (msg, type = "info", details = "") => {
    const entry = {
      id: Date.now(),
      msg,
      type,
      details,
      time: new Date().toLocaleTimeString(),
    };
    setLogs((prev) => [...prev.slice(-50), entry]);
    if (containerRef.current) {
      setTimeout(() => {
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
      }, 0);
    }
  };

  const addTestLog = (msg, type = "info") => {
    const entry = { msg, type, time: new Date().toLocaleTimeString() };
    setTestLog((prev) => [...prev.slice(-20), entry]);
  };

  const startPipeline = async () => {
    if (!groqKey.trim()) {
      toast({ title: "API key required", description: "Paste your Groq key to continue" });
      return;
    }

    setRunning(true);
    setPaused(false);
    setScannedCards([]);
    setExtractedAttacks([]);
    setGeneratedMechanics([]);
    setLogs([]);
    setStage("scanning");
    addLog("Pipeline started", "info");

    try {
      // STAGE 1: Scan cards
      addLog("Fetching card catalog", "info");
      const { cards } = await fetchCatalogCards({
        search: "",
        filter: "all",
        page: 1,
        pageSize: cardsPerBatch,
      });

      if (cards.length === 0) {
        addLog("No cards found in catalog", "error");
        setRunning(false);
        return;
      }

      addLog(`Found ${cards.length} cards`, "ok");
      setScanProgress(33);

      // Simulate card scanning with animation
      for (let i = 0; i < cards.length; i++) {
        if (paused) {
          addLog("Pipeline paused", "warn");
          await new Promise((r) => {
            const checkInterval = setInterval(() => {
              if (!paused) {
                clearInterval(checkInterval);
                r();
              }
            }, 500);
          });
        }

        setScannedCards((prev) => [...prev, cards[i]]);
        setScanProgress(33 + (i / cards.length) * 33);
        await new Promise((r) => setTimeout(r, 50)); // Smooth animation
      }

      addLog(`Scanned ${cards.length} cards`, "ok");
      setScanProgress(66);

      // Extract attacks
      const attacks = [];
      cards.forEach((card) => {
        if (card.attack1_name && card.attack1_damage) {
          attacks.push({
            card: card.name,
            attack: card.attack1_name,
            damage: card.attack1_damage,
            cost: card.attack1_cost,
            description: card.attack1_description || "",
          });
        }
        if (card.attack2_name && card.attack2_damage) {
          attacks.push({
            card: card.name,
            attack: card.attack2_name,
            damage: card.attack2_damage,
            cost: card.attack2_cost,
            description: card.attack2_description || "",
          });
        }
      });

      setExtractedAttacks(attacks);
      addLog(`Extracted ${attacks.length} attacks`, "ok");
      setScanProgress(99);

      // STAGE 2: Generate mechanics
      setStage("generating");
      addLog("Calling Groq to analyze mechanics", "info");
      setGenerationProgress(0);

      const prompt = `Analyze these Pokémon TCG card attacks and identify UNIQUE mechanics (not: basic damage, coin flip, draw, discard, heal, apply status).

Attacks:
${attacks
  .slice(0, 15)
  .map(
    (a, i) =>
      `${i + 1}. [${a.card}] "${a.attack}" (${a.damage} dmg) - ${a.description || "standard attack"}`
  )
  .join("\n")}

For EACH unique mechanic found, output ONLY valid JavaScript in this format:

\`\`\`javascript
registerCustomMechanic("mechanic-id", (gs, pk, opts) => {
  let updated = JSON.parse(JSON.stringify(gs));
  // Your mechanic logic here
  return { ...updated, extraLog: "Description" };
});
\`\`\`

NO explanations, NO markdown, ONLY code blocks.`;

      const response = await fetch(GROQ_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${groqKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                "You are a code generator. Output ONLY valid JavaScript code. No explanations.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 3000,
        }),
      });

      setGenerationProgress(50);

      if (!response.ok) {
        const err = await response.text();
        addLog(`Groq error: ${response.status}`, "error", err.slice(0, 200));
        setRunning(false);
        return;
      }

      const data = await response.json();
      const rawCode = data.choices?.[0]?.message?.content || "";

      addLog("Received code from Groq", "ok");
      setGenerationProgress(75);

      // Parse code blocks
      const codeBlocks = rawCode
        .split("```javascript")
        .slice(1)
        .map((block) => block.split("```")[0].trim())
        .filter((b) => b.length > 0 && b.includes("registerCustomMechanic"));

      addLog(`Generated ${codeBlocks.length} mechanics`, "ok");

      // Parse mechanics for testing
      const parsedMechanics = codeBlocks.map((code, idx) => ({
        id: `mechanic-${idx}`,
        code,
        name: extractMechanicName(code),
        status: "generated",
        tested: false,
        errors: [],
      }));

      setGeneratedMechanics(parsedMechanics);
      setGenerationProgress(100);
      setStage("testing");

      addLog("Ready to test mechanics", "ok");
      toast({
        title: "Pipeline complete",
        description: `Generated ${parsedMechanics.length} mechanics. Ready to test.`,
      });
    } catch (e) {
      addLog(`Error: ${e.message}`, "error");
      toast({ title: "Pipeline failed", description: e.message });
    } finally {
      setRunning(false);
    }
  };

  const extractMechanicName = (code) => {
    const match = code.match(/registerCustomMechanic\("([^"]+)"/);
    return match ? match[1] : "unknown";
  };

  const testMechanic = (mechanic) => {
    addTestLog(`Testing ${mechanic.name}...`, "info");

    try {
      // Parse the code
      const codeStr = mechanic.code.replace(/registerCustomMechanic\(/, "const test = ");
      const func = new Function("gs", "pk", "opts", codeStr.split("=>")[1].trim());

      // Mock game state
      const mockGs = {
        player1: {
          id: "p1",
          activePokemon: { def: { name: "Pikachu", hp: 60 }, damage: 0 },
          bench: [{ def: { name: "Raichu", hp: 80 }, damage: 0 }],
          hand: [],
        },
        player2: {
          id: "p2",
          activePokemon: { def: { name: "Charmander", hp: 50 }, damage: 0 },
          bench: [],
          hand: [],
        },
      };

      const result = func(mockGs, "player1", {});
      addTestLog(`✓ Mechanic executed successfully`, "ok");
      addTestLog(`Result: ${result.extraLog || "No log"}`, "ok");

      // Mark as tested
      setGeneratedMechanics((prev) =>
        prev.map((m) =>
          m.id === mechanic.id ? { ...m, tested: true, status: "success" } : m
        )
      );
    } catch (e) {
      addTestLog(`✗ Error: ${e.message}`, "error");
      setGeneratedMechanics((prev) =>
        prev.map((m) =>
          m.id === mechanic.id
            ? { ...m, tested: true, status: "error", errors: [e.message] }
            : m
        )
      );
    }
  };

  const downloadAll = () => {
    const finalCode = `// Auto-generated by Mechanic Studio
// Paste this into src/lib/customMechanics.js inside registerDefaultMechanics()

${generatedMechanics.map((m) => m.code).join("\n\n")}
`;

    const blob = new Blob([finalCode], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mechanics.js";
    a.click();
    toast({ title: "Downloaded", description: "mechanics.js ready to merge" });
  };

  const copyAllCode = () => {
    const code = generatedMechanics.map((m) => m.code).join("\n\n");
    navigator.clipboard.writeText(code);
    toast({ title: "Copied", description: "All mechanics copied to clipboard" });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate("/admin")}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <div className="flex items-center gap-3">
            <p className="font-display font-bold text-lg">Mechanic Studio</p>
            <Badge variant="secondary" className="font-body">
              {stage === "setup"
                ? "Ready"
                : stage === "scanning"
                ? "Scanning"
                : stage === "generating"
                ? "Generating"
                : stage === "testing"
                ? "Testing"
                : "Complete"}
            </Badge>
          </div>
          <div className="flex gap-2">
            {running && (
              <Button
                onClick={() => setPaused(!paused)}
                size="sm"
                variant="outline"
                className="font-body gap-1.5"
              >
                {paused ? (
                  <>
                    <Play className="w-3.5 h-3.5" /> Resume
                  </>
                ) : (
                  <>
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Setup & Controls */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
              <h2 className="font-display font-bold text-lg">Configuration</h2>

              <div>
                <label className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2 block">
                  Groq API Key
                </label>
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  disabled={running}
                  placeholder="gsk_..."
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground disabled:opacity-50"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Free at console.groq.com
                </p>
              </div>

              <div>
                <label className="text-xs font-body text-muted-foreground uppercase tracking-widest mb-2 block">
                  Cards to scan
                </label>
                <input
                  type="number"
                  value={cardsPerBatch}
                  onChange={(e) => setCardsPerBatch(Number(e.target.value))}
                  disabled={running}
                  min="10"
                  max="200"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground disabled:opacity-50"
                />
              </div>

              <Button
                onClick={startPipeline}
                disabled={running}
                className="w-full font-body gap-2"
              >
                {running ? (
                  <>
                    <Zap className="w-4 h-4 animate-spin" /> Running...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" /> Start Pipeline
                  </>
                )}
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Cards", value: scannedCards.length },
                { label: "Attacks", value: extractedAttacks.length },
                { label: "Mechanics", value: generatedMechanics.length },
                {
                  label: "Tested",
                  value: generatedMechanics.filter((m) => m.tested).length,
                },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-secondary/40 p-3 text-center"
                >
                  <p className="text-2xl font-display font-black text-primary">
                    {stat.value}
                  </p>
                  <p className="text-xs font-body text-muted-foreground mt-1">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Center: Live view */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Scanning */}
            {(stage === "scanning" || scannedCards.length > 0) && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h2 className="font-display font-bold text-lg flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-500" />
                  Scanning ({scannedCards.length}/{cardsPerBatch})
                </h2>

                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-primary rounded-full"
                    animate={{ width: `${scanProgress}%` }}
                  />
                </div>

                <div className="max-h-32 overflow-y-auto space-y-1">
                  {scannedCards.slice(-5).map((card, idx) => (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="text-xs font-body text-muted-foreground flex items-center gap-2"
                    >
                      <Check className="w-3 h-3 text-green-500" />
                      {card.name}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Generating */}
            {(stage === "generating" || generatedMechanics.length > 0) && (
              <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                <h2 className="font-display font-bold text-lg flex items-center gap-2">
                  <Code className="w-5 h-5 text-amber-500" />
                  Generating ({generatedMechanics.length})
                </h2>

                {stage === "generating" && (
                  <div className="h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-amber-500 to-primary rounded-full"
                      animate={{ width: `${generationProgress}%` }}
                    />
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto space-y-2">
                  {generatedMechanics.map((mech) => (
                    <motion.button
                      key={mech.id}
                      onClick={() => setSelectedMechanic(mech)}
                      whileHover={{ scale: 1.02 }}
                      className={`w-full p-3 rounded-lg text-left transition-colors border ${
                        selectedMechanic?.id === mech.id
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/40 hover:bg-secondary/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-body font-semibold truncate">
                          {mech.name}
                        </span>
                        {mech.tested && (
                          <div className="flex-shrink-0">
                            {mech.status === "success" ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <X className="w-4 h-4 text-red-500" />
                            )}
                          </div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Right: Details & Export */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {selectedMechanic ? (
              <>
                {/* Code view */}
                <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-display font-bold text-base">
                      {selectedMechanic.name}
                    </h3>
                    <Button
                      onClick={() => testMechanic(selectedMechanic)}
                      size="sm"
                      className="font-body gap-1.5"
                    >
                      <Play className="w-3 h-3" /> Test
                    </Button>
                  </div>

                  <div className="bg-secondary/60 rounded-lg p-3 overflow-x-auto max-h-64 overflow-y-auto">
                    <pre className="font-mono text-xs text-foreground/80 whitespace-pre-wrap break-words">
                      {selectedMechanic.code}
                    </pre>
                  </div>

                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedMechanic.code);
                      toast({ title: "Copied" });
                    }}
                    variant="outline"
                    size="sm"
                    className="w-full font-body"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy code
                  </Button>
                </div>

                {/* Test results */}
                {(selectedMechanic.tested || testLog.length > 0) && (
                  <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
                    <h3 className="font-display font-bold text-base">Test Results</h3>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {testLog.map((log, idx) => (
                        <div
                          key={idx}
                          className={`text-xs font-body p-2 rounded ${
                            log.type === "error"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-green-500/10 text-green-500"
                          }`}
                        >
                          {log.msg}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6 flex items-center justify-center h-64">
                <p className="text-muted-foreground text-sm font-body text-center">
                  Select a mechanic to view details
                </p>
              </div>
            )}

            {/* Export */}
            {generatedMechanics.length > 0 && (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-3">
                <h3 className="font-display font-bold text-base">Export</h3>
                <Button
                  onClick={downloadAll}
                  className="w-full font-body gap-2"
                >
                  <Download className="w-4 h-4" /> Download all
                </Button>
                <Button
                  onClick={copyAllCode}
                  variant="outline"
                  className="w-full font-body gap-2"
                >
                  <Copy className="w-4 h-4" /> Copy all
                </Button>
              </div>
            )}
          </motion.div>
        </div>

        {/* Bottom: Live log */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-card p-6"
        >
          <h2 className="font-display font-bold text-lg mb-4">Live activity log</h2>
          <div
            ref={containerRef}
            className="bg-secondary/40 rounded-lg p-4 h-48 overflow-y-auto space-y-1"
          >
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-sm font-body">
                Logs will appear here as the pipeline runs...
              </p>
            ) : (
              logs.map((log) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`text-xs font-mono flex items-start gap-2 ${
                    log.type === "error"
                      ? "text-red-500"
                      : log.type === "warn"
                      ? "text-yellow-500"
                      : log.type === "ok"
                      ? "text-green-500"
                      : "text-muted-foreground"
                  }`}
                >
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    [{log.time}]
                  </span>
                  <div>
                    <div>{log.msg}</div>
                    {log.details && (
                      <div className="text-[10px] opacity-60 mt-0.5">
                        {log.details}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      </div>

      <BottomNav />
    </div>
  );
}
