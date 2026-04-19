import React, { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Music, Play, Plus, Trash2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import BottomNav from "@/components/tcg/BottomNav";

const DEFAULT_SOUNDS = [
  { id: "card-flip", name: "Card Flip", file: "", volume: 80, enabled: true, category: "battle" },
  { id: "card-draw", name: "Card Draw", file: "", volume: 75, enabled: true, category: "battle" },
  { id: "attack-hit", name: "Attack Hit", file: "", volume: 85, enabled: true, category: "battle" },
  { id: "damage-taken", name: "Damage Taken", file: "", volume: 80, enabled: true, category: "battle" },
  { id: "ability-trigger", name: "Ability Trigger", file: "", volume: 70, enabled: true, category: "battle" },
  { id: "energy-attach", name: "Energy Attach", file: "", volume: 65, enabled: true, category: "battle" },
  { id: "pokemon-ko", name: "Pokémon KO", file: "", volume: 90, enabled: true, category: "battle" },
  { id: "turn-end", name: "Turn End", file: "", volume: 60, enabled: true, category: "ui" },
  { id: "menu-select", name: "Menu Select", file: "", volume: 50, enabled: true, category: "ui" },
  { id: "victory", name: "Victory", file: "", volume: 100, enabled: true, category: "result" },
  { id: "defeat", name: "Defeat", file: "", volume: 100, enabled: true, category: "result" },
  { id: "ambient-music", name: "Battle Music", file: "", volume: 50, enabled: true, category: "music", isMusic: true },
];

export default function SoundAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sounds, setSounds] = useState(() => {
    const saved = localStorage.getItem("game-sounds-config");
    return saved ? JSON.parse(saved) : DEFAULT_SOUNDS;
  });
  const [editingId, setEditingId] = useState(null);
  const [editingFile, setEditingFile] = useState("");

  const saveSounds = () => {
    localStorage.setItem("game-sounds-config", JSON.stringify(sounds));
    toast({ title: "Saved", description: `${sounds.length} sound settings saved.` });
  };

  const toggleSound = (id) => {
    setSounds(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const updateVolume = (id, volume) => {
    setSounds(prev =>
      prev.map(s => (s.id === id ? { ...s, volume } : s))
    );
  };

  const updateFile = (id, file) => {
    setSounds(prev =>
      prev.map(s => (s.id === id ? { ...s, file } : s))
    );
    setEditingId(null);
    setEditingFile("");
  };

  const playSound = (sound) => {
    if (!sound.file) {
      toast({ title: "No sound", description: "Upload an audio file first." });
      return;
    }
    // In production, play the audio file
    const audio = new Audio(sound.file);
    audio.volume = sound.volume / 100;
    audio.play().catch(e => console.log("Play failed:", e));
  };

  const deleteSound = (id) => {
    setSounds(prev => prev.filter(s => s.id !== id));
    toast({ title: "Deleted", description: "Sound removed from config." });
  };

  const addCustomSound = () => {
    const newId = `custom-${Date.now()}`;
    setSounds(prev => [
      ...prev,
      {
        id: newId,
        name: "Custom Sound",
        file: "",
        volume: 75,
        enabled: true,
        category: "custom",
      },
    ]);
  };

  const categories = [...new Set(sounds.map(s => s.category))];

  const exportConfig = () => {
    const json = JSON.stringify(sounds, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sound-config.json";
    a.click();
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <button
            onClick={() => {
              saveSounds();
              navigate("/admin");
            }}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors font-body text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Admin
          </button>
          <p className="font-display font-bold text-base">Sound Settings</p>
          <Button onClick={saveSounds} size="sm" className="font-body gap-1.5">
            Saved
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Info */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-start gap-3">
            <Music className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-body font-semibold">Sound Design Helper</p>
              <p className="text-sm font-body text-muted-foreground mt-1">
                No audio expertise needed. Just upload MP3/WAV files, set volume, and toggle on/off. 
                The game engine will play them at the right moments.
              </p>
            </div>
          </div>
        </div>

        {/* Categories */}
        {categories.map(cat => {
          const catSounds = sounds.filter(s => s.category === cat);
          return (
            <motion.div
              key={cat}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-5 space-y-3"
            >
              <p className="font-display font-bold text-lg capitalize">{cat === "music" ? "Music" : `${cat} Sounds`}</p>

              <div className="space-y-2">
                {catSounds.map(sound => (
                  <div key={sound.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-secondary/30 transition-colors">
                    {/* Toggle */}
                    <button
                      onClick={() => toggleSound(sound.id)}
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                        sound.enabled ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {sound.enabled ? (
                        <Volume2 className="w-3.5 h-3.5" />
                      ) : (
                        <VolumeX className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {/* Name */}
                    <div className="flex-1">
                      <p className="font-body font-semibold text-sm">{sound.name}</p>
                      {sound.file && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sound.file}</p>
                      )}
                    </div>

                    {/* Volume slider */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sound.volume}
                        onChange={e => updateVolume(sound.id, Number(e.target.value))}
                        className="w-20 h-1.5 rounded-full bg-secondary cursor-pointer"
                      />
                      <span className="text-xs font-display font-bold w-6 text-right">{sound.volume}</span>
                    </div>

                    {/* Play button */}
                    <button
                      onClick={() => playSound(sound)}
                      className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground flex-shrink-0"
                      title="Preview"
                    >
                      <Play className="w-4 h-4" />
                    </button>

                    {/* File input / Edit */}
                    {editingId === sound.id ? (
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={editingFile}
                          onChange={e => setEditingFile(e.target.value)}
                          placeholder="Paste audio URL or file path"
                          className="text-xs px-2 py-1 rounded border border-border bg-background w-40"
                        />
                        <Button
                          onClick={() => updateFile(sound.id, editingFile)}
                          size="sm"
                          className="font-body text-xs h-7"
                        >
                          Set
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(sound.id);
                          setEditingFile(sound.file || "");
                        }}
                        className="text-xs px-2 py-1 rounded border border-border bg-secondary hover:bg-secondary/70 transition-colors font-body text-muted-foreground flex-shrink-0"
                      >
                        {sound.file ? "Change" : "Add file"}
                      </button>
                    )}

                    {/* Delete */}
                    {sound.category === "custom" && (
                      <button
                        onClick={() => deleteSound(sound.id)}
                        className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}

        {/* Add custom sound */}
        <Button onClick={addCustomSound} variant="outline" className="w-full font-body gap-2">
          <Plus className="w-4 h-4" /> Add custom sound
        </Button>

        {/* Resources */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="font-display font-bold text-base">Free sound resources</p>
          <div className="space-y-2 text-sm font-body text-muted-foreground">
            <p>
              <strong>Freesound.com:</strong> Search for "card flip", "game sfx", "victory chime" — filter by Creative Commons
            </p>
            <p>
              <strong>Zapsplat.com:</strong> Free SFX library, no signup needed for download
            </p>
            <p>
              <strong>OpenGameArt.org:</strong> Music and SFX from game devs
            </p>
            <p>
              <strong>Pixabay:</strong> Music library with filtering by mood/genre
            </p>
          </div>
        </div>

        {/* Export */}
        <Button onClick={exportConfig} variant="outline" className="w-full font-body gap-2">
          Export config as JSON
        </Button>
      </div>
      <BottomNav />
    </div>
  );
}
