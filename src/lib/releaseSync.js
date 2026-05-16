import { fetchSets, searchCards } from "@/lib/pokemonTCGApi";
import { inferMechanicsFromAttackText } from "@/lib/customMechanics";
import { registerCatalogCards, normalizeApiCardToCatalog } from "@/lib/cardCatalog";

const SYNC_STATE_KEY = "local_tcg_live_release_sync_v1";
const MECHANIC_CACHE_KEY = "local_tcg_live_auto_mechanics_v1";
const DEFAULT_DAYS_BACK = 45;

function canStore() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJson(key, fallback) {
  if (!canStore()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (!canStore()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore write errors.
  }
}

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildMechanicMap(cards) {
  const map = {};
  for (const card of cards) {
    if (!Array.isArray(card?.attacks)) continue;
    for (const atk of card.attacks) {
      const auto = inferMechanicsFromAttackText(atk?.text || "");
      if (!auto.length) continue;
      map[`${card.id}:${atk.name}`] = auto;
    }
  }
  return map;
}

export function getAutoMechanicMap() {
  return readJson(MECHANIC_CACHE_KEY, {});
}

export async function syncLatestReleases(options = {}) {
  const daysBack = Number(options.daysBack || DEFAULT_DAYS_BACK);
  const state = readJson(SYNC_STATE_KEY, { lastSyncAt: null, setIds: [] });

  const sets = await fetchSets();
  const threshold = isoDateDaysAgo(daysBack);
  const recentSets = (sets || []).filter((set) => (set.releaseDate || "") >= threshold);

  let imported = [];
  for (const set of recentSets) {
    if (!set?.id) continue;
    const cards = await searchCards(`set.id:${set.id}`);
    imported.push(...cards);
  }

  imported = imported.filter((card) => card?.id);
  const normalized = imported.map((card) => normalizeApiCardToCatalog(card));
  registerCatalogCards(normalized);

  const mechanicMap = {
    ...getAutoMechanicMap(),
    ...buildMechanicMap(normalized),
  };
  writeJson(MECHANIC_CACHE_KEY, mechanicMap);

  const next = {
    lastSyncAt: new Date().toISOString(),
    setIds: recentSets.map((s) => s.id),
    importedCount: normalized.length,
  };
  writeJson(SYNC_STATE_KEY, next);
  return next;
}
