// ============================================================
// Sound Manager — play game audio without coding required.
// Config is an array of {id, name, file, volume, enabled,
// category} persisted in localStorage by <SoundAdmin/>. Missing
// entries fall back to a tiny programmatic WebAudio beep so the
// game never plays dead silence.
// ============================================================

const STORAGE_KEY = "game-sounds-config";

// Source of truth for which sound IDs exist. Must match the
// list used by <SoundAdmin/>.
export const DEFAULT_SOUNDS = [
  { id: "card-flip",       name: "Card Flip",       file: "", volume: 70, enabled: true, category: "ui",      tone: [620, 0.06] },
  { id: "card-draw",       name: "Card Draw",       file: "", volume: 65, enabled: true, category: "ui",      tone: [500, 0.05] },
  { id: "attack-hit",      name: "Attack Hit",      file: "", volume: 80, enabled: true, category: "battle",  tone: [180, 0.12, "square"] },
  { id: "damage-taken",    name: "Damage Taken",    file: "", volume: 75, enabled: true, category: "battle",  tone: [120, 0.14, "sawtooth"] },
  { id: "ability-trigger", name: "Ability Trigger", file: "", volume: 80, enabled: true, category: "battle",  tone: [880, 0.10] },
  { id: "energy-attach",   name: "Energy Attach",   file: "", volume: 70, enabled: true, category: "battle",  tone: [760, 0.08] },
  { id: "pokemon-ko",      name: "Pokémon KO",      file: "", volume: 90, enabled: true, category: "battle",  tone: [80, 0.40, "sawtooth"] },
  { id: "turn-end",        name: "Turn End",        file: "", volume: 70, enabled: true, category: "battle",  tone: [440, 0.12] },
  { id: "menu-select",     name: "Menu Select",     file: "", volume: 60, enabled: true, category: "ui",      tone: [780, 0.05] },
  { id: "victory",         name: "Victory",         file: "", volume: 90, enabled: true, category: "result",  tone: [880, 0.45] },
  { id: "defeat",          name: "Defeat",          file: "", volume: 90, enabled: true, category: "result",  tone: [220, 0.60, "sawtooth"] },
  { id: "ambient-music",   name: "Battle Music",    file: "", volume: 40, enabled: false, category: "music" },
];

function normalizeConfig(raw) {
  // Accepts the historic shapes we've seen in localStorage and
  // coerces them into a flat array keyed by id.
  let parsed;
  if (Array.isArray(raw)) parsed = raw;
  else if (raw && Array.isArray(raw.sounds)) parsed = raw.sounds;
  else if (raw && typeof raw === "object") parsed = Object.entries(raw).map(([id, v]) => ({ id, ...(v || {}) }));
  else parsed = [];

  const byId = new Map(parsed.map((s) => [s.id, s]));
  return DEFAULT_SOUNDS.map((def) => ({ ...def, ...(byId.get(def.id) || {}) }));
}

class SoundManager {
  constructor() {
    this.config = this.loadConfig();
    this.currentMusic = null;
    this._audioCtx = null;
    this._muted = false;
  }

  loadConfig() {
    if (typeof window === "undefined") return [...DEFAULT_SOUNDS];
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      return normalizeConfig(saved ? JSON.parse(saved) : null);
    } catch (e) {
      console.warn("Failed to load sound config:", e);
      return [...DEFAULT_SOUNDS];
    }
  }

  reloadConfig() {
    this.config = this.loadConfig();
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    if (this._muted && this.currentMusic) this.currentMusic.pause();
  }

  getSound(id) {
    if (!Array.isArray(this.config)) this.config = [...DEFAULT_SOUNDS];
    return this.config.find((s) => s && s.id === id) || null;
  }

  _getAudioCtx() {
    if (typeof window === "undefined") return null;
    try {
      if (!this._audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        this._audioCtx = new Ctx();
      }
      return this._audioCtx;
    } catch {
      return null;
    }
  }

  _playTone(sound) {
    const ctx = this._getAudioCtx();
    if (!ctx || !sound?.tone) return;
    const [freq, duration, wave = "sine"] = sound.tone;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.value = freq;
      const vol = Math.max(0, Math.min(1, (sound.volume || 75) / 100)) * 0.25;
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      /* ignore */
    }
  }

  async play(id) {
    if (this._muted) return;
    const sound = this.getSound(id);
    if (!sound || sound.enabled === false) return;

    if (sound.file) {
      try {
        const audio = new Audio(sound.file);
        audio.volume = Math.max(0, Math.min(1, (sound.volume || 75) / 100));
        await audio.play();
        return;
      } catch (e) {
        // Fall through to the tone fallback.
        console.warn(`Failed to play ${id} from file, falling back to tone:`, e);
      }
    }
    this._playTone(sound);
  }

  async playMusic(id) {
    if (this._muted) return;
    const sound = this.getSound(id);
    if (!sound || sound.enabled === false || !sound.file) return;

    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
    }

    try {
      const audio = new Audio(sound.file);
      audio.volume = Math.max(0, Math.min(1, (sound.volume || 50) / 100));
      audio.loop = true;
      await audio.play();
      this.currentMusic = audio;
    } catch (e) {
      console.warn(`Failed to play music ${id}:`, e);
    }
  }

  stopMusic() {
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
    }
  }

  setVolume(id, volume) {
    const sound = this.getSound(id);
    if (sound) sound.volume = Math.max(0, Math.min(100, volume));
  }

  // Convenience event shortcuts
  cardFlip()        { return this.play("card-flip"); }
  cardDraw()        { return this.play("card-draw"); }
  attackHit()       { return this.play("attack-hit"); }
  damageTaken()     { return this.play("damage-taken"); }
  abilityTrigger()  { return this.play("ability-trigger"); }
  energyAttach()    { return this.play("energy-attach"); }
  pokemonKO()       { return this.play("pokemon-ko"); }
  turnEnd()         { return this.play("turn-end"); }
  menuSelect()      { return this.play("menu-select"); }
  victory()         { return this.play("victory"); }
  defeat()          { return this.play("defeat"); }
  playBattleMusic() { return this.playMusic("ambient-music"); }
}

export const soundManager = new SoundManager();
