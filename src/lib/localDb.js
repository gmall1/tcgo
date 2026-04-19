const STORAGE_KEY = "tcg_local_db_v1";
const USER_KEY = "tcg_local_user_v1";
const EVENT_KEY = "tcg_local_db_event_v1";

const listeners = {
  Deck: new Set(),
  GameRoom: new Set(),
  Match: new Set(),
  PlayerRank: new Set(),
};

let storageListenerBound = false;

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDefaultState() {
  return {
    Deck: [],
    GameRoom: [],
    Match: [],
    PlayerRank: [],
  };
}

function readState() {
  if (!canUseBrowserStorage()) {
    return getDefaultState();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getDefaultState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }

    const parsed = JSON.parse(raw);
    return { ...getDefaultState(), ...parsed };
  } catch (error) {
    console.error("Failed to read local database:", error);
    return getDefaultState();
  }
}

function writeState(nextState, changedEntity, payload) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  emit(changedEntity, payload);

  try {
    window.localStorage.setItem(
      EVENT_KEY,
      JSON.stringify({
        entity: changedEntity,
        payload,
        timestamp: Date.now(),
      })
    );
    window.localStorage.removeItem(EVENT_KEY);
  } catch (error) {
    console.error("Failed to broadcast local database event:", error);
  }
}

function emit(entity, payload) {
  if (!entity || !listeners[entity]) {
    return;
  }

  listeners[entity].forEach((callback) => {
    try {
      callback(payload);
    } catch (error) {
      console.error(`Listener error for ${entity}:`, error);
    }
  });
}

function bindStorageListener() {
  if (!canUseBrowserStorage() || storageListenerBound) {
    return;
  }

  window.addEventListener("storage", (event) => {
    if (event.key !== EVENT_KEY || !event.newValue) {
      return;
    }

    try {
      const message = JSON.parse(event.newValue);
      emit(message.entity, message.payload);
    } catch (error) {
      console.error("Failed to parse local database event:", error);
    }
  });

  storageListenerBound = true;
}

function matchesQuery(record, query = {}) {
  return Object.entries(query).every(([key, value]) => record?.[key] === value);
}

function sortRecords(records, sortSpec) {
  if (!sortSpec) {
    return [...records];
  }

  const descending = sortSpec.startsWith("-");
  const key = descending ? sortSpec.slice(1) : sortSpec;

  return [...records].sort((a, b) => {
    const av = a?.[key];
    const bv = b?.[key];

    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (av < bv) return descending ? 1 : -1;
    if (av > bv) return descending ? -1 : 1;
    return 0;
  });
}

function getCollection(entity) {
  const state = readState();
  return state[entity] || [];
}

function writeCollection(entity, records, payload) {
  const state = readState();
  const nextState = { ...state, [entity]: records };
  writeState(nextState, entity, payload);
}

function ensureCurrentUser() {
  if (!canUseBrowserStorage()) {
    return {
      id: "guest_local",
      full_name: "Local Player",
      email: "local@example.com",
      role: "player",
    };
  }

  let user;
  try {
    user = JSON.parse(window.localStorage.getItem(USER_KEY) || "null");
  } catch {
    user = null;
  }

  if (!user?.id) {
    user = {
      id: createId("user"),
      full_name: "Local Player",
      email: "local@example.com",
      role: "player",
    };
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  ensurePlayerRank(user.id, user.full_name);
  seedLeaderboard();
  bindStorageListener();

  return user;
}

function ensurePlayerRank(userId, username) {
  const ranks = getCollection("PlayerRank");
  const existing = ranks.find((rank) => rank.user_id === userId);
  if (existing) {
    return existing;
  }

  const created = {
    id: createId("rank"),
    user_id: userId,
    username,
    elo: 1000,
    rank_tier: "bronze",
    wins: 0,
    losses: 0,
    win_streak: 0,
    season: "local",
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
  };

  writeCollection("PlayerRank", [created, ...ranks], created);
  return created;
}

function seedLeaderboard() {
  const ranks = getCollection("PlayerRank");
  if (ranks.length >= 4) {
    return;
  }

  const seeds = [
    { username: "AI Spark", elo: 1180, rank_tier: "silver", wins: 12, losses: 9 },
    { username: "Gym Leader", elo: 1340, rank_tier: "gold", wins: 19, losses: 11 },
    { username: "Elite Four", elo: 1590, rank_tier: "platinum", wins: 31, losses: 14 },
  ].map((entry) => ({
    id: createId("rank"),
    user_id: slugify(entry.username),
    season: "local",
    win_streak: 0,
    created_date: new Date().toISOString(),
    updated_date: new Date().toISOString(),
    ...entry,
  }));

  const byUser = new Set(ranks.map((rank) => rank.user_id));
  const merged = [...ranks];
  seeds.forEach((seed) => {
    if (!byUser.has(seed.user_id)) {
      merged.push(seed);
    }
  });

  writeCollection("PlayerRank", merged, { seeded: true });
}

function createEntityApi(entity) {
  bindStorageListener();

  return {
    async list(sortSpec, limit = 100) {
      const records = sortRecords(getCollection(entity), sortSpec);
      return records.slice(0, limit);
    },

    async filter(query = {}) {
      return getCollection(entity).filter((record) => matchesQuery(record, query));
    },

    async get(id) {
      return getCollection(entity).find((record) => record.id === id) || null;
    },

    async create(data = {}) {
      const now = new Date().toISOString();
      const record = {
        id: data.id || createId(entity.toLowerCase()),
        created_date: data.created_date || now,
        updated_date: now,
        ...data,
      };
      const records = [...getCollection(entity), record];
      writeCollection(entity, records, record);
      return record;
    },

    async update(id, patch = {}) {
      const now = new Date().toISOString();
      let updatedRecord = null;
      const records = getCollection(entity).map((record) => {
        if (record.id !== id) {
          return record;
        }
        updatedRecord = { ...record, ...patch, id, updated_date: now };
        return updatedRecord;
      });

      if (!updatedRecord) {
        throw new Error(`${entity} record not found`);
      }

      writeCollection(entity, records, updatedRecord);
      return updatedRecord;
    },

    async delete(id) {
      const records = getCollection(entity);
      const removed = records.find((record) => record.id === id) || null;
      writeCollection(
        entity,
        records.filter((record) => record.id !== id),
        { id, deleted: true }
      );
      return removed;
    },

    subscribe(callback) {
      listeners[entity].add(callback);
      return () => listeners[entity].delete(callback);
    },
  };
}

const db = {
  auth: {
    async isAuthenticated() {
      return true;
    },
    async me() {
      return ensureCurrentUser();
    },
  },
  entities: {
    Deck: createEntityApi("Deck"),
    GameRoom: createEntityApi("GameRoom"),
    Match: createEntityApi("Match"),
    PlayerRank: createEntityApi("PlayerRank"),
  },
  integrations: {
    Core: {
      async UploadFile() {
        return { file_url: "" };
      },
    },
  },
};

export function getCurrentUserSync() {
  return ensureCurrentUser();
}

export function updateCurrentUserName(name) {
  const current = ensureCurrentUser();
  const nextUser = {
    ...current,
    full_name: name || current.full_name,
  };

  if (canUseBrowserStorage()) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }

  const existingRank = getCollection("PlayerRank").find((rank) => rank.user_id === nextUser.id);
  if (existingRank) {
    db.entities.PlayerRank.update(existingRank.id, { username: nextUser.full_name });
  }

  return nextUser;
}

export function resetLocalDatabase() {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

export { ensurePlayerRank };
export default db;
