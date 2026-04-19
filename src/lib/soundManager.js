// ============================================================
// Sound Manager — play game audio without coding required
// ============================================================

class SoundManager {
  constructor() {
    this.config = this.loadConfig();
    this.currentMusic = null;
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem("game-sounds-config");
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      console.warn("Failed to load sound config:", e);
      return {};
    }
  }

  getSound(id) {
    return this.config.find?.(s => s.id === id) || null;
  }

  async play(id) {
    const sound = this.getSound(id);
    if (!sound || !sound.enabled || !sound.file) return;

    try {
      const audio = new Audio(sound.file);
      audio.volume = (sound.volume || 75) / 100;
      await audio.play();
    } catch (e) {
      console.warn(`Failed to play ${id}:`, e);
    }
  }

  async playMusic(id) {
    const sound = this.getSound(id);
    if (!sound || !sound.enabled || !sound.file) return;

    // Stop current music
    if (this.currentMusic) {
      this.currentMusic.pause();
      this.currentMusic = null;
    }

    try {
      const audio = new Audio(sound.file);
      audio.volume = (sound.volume || 50) / 100;
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
    if (sound) {
      sound.volume = Math.max(0, Math.min(100, volume));
    }
  }

  // Game event shortcuts
  async cardFlip() { await this.play("card-flip"); }
  async cardDraw() { await this.play("card-draw"); }
  async attackHit() { await this.play("attack-hit"); }
  async damageTaken() { await this.play("damage-taken"); }
  async abilityTrigger() { await this.play("ability-trigger"); }
  async energyAttach() { await this.play("energy-attach"); }
  async pokemonKO() { await this.play("pokemon-ko"); }
  async turnEnd() { await this.play("turn-end"); }
  async menuSelect() { await this.play("menu-select"); }
  async victory() { await this.play("victory"); }
  async defeat() { await this.play("defeat"); }
  async playBattleMusic() { await this.playMusic("ambient-music"); }
}

export const soundManager = new SoundManager();
