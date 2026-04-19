// =============================================================
// Network client — optional networked multiplayer over HTTP + WS.
// If VITE_BACKEND_URL is unset the client reports `available = false`,
// and the rest of the app continues using localStorage for sync.
// =============================================================

const ENV_URL =
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_BACKEND_URL : "";
const RUNTIME_KEY = "tcg_network_backend_url_v1";

function readRuntimeUrl() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(RUNTIME_KEY) || "";
  } catch {
    return "";
  }
}

function normalize(url) {
  if (!url) return "";
  return url.replace(/\/$/, "");
}

let cachedBase = normalize(ENV_URL || readRuntimeUrl());

export function getBackendUrl() {
  return cachedBase;
}

export function setBackendUrl(url) {
  cachedBase = normalize(url || "");
  try {
    if (typeof window !== "undefined") {
      if (cachedBase) window.localStorage.setItem(RUNTIME_KEY, cachedBase);
      else window.localStorage.removeItem(RUNTIME_KEY);
    }
  } catch {
    /* storage unavailable */
  }
  return cachedBase;
}

export function isNetworkAvailable() {
  return Boolean(cachedBase);
}

export function wsUrlFor(path) {
  if (!cachedBase) return "";
  const httpUrl = new URL(path, cachedBase + "/");
  httpUrl.protocol = httpUrl.protocol.replace("http", "ws");
  return httpUrl.toString();
}

async function request(path, { method = "GET", body } = {}) {
  if (!cachedBase) {
    throw new Error("Network backend is not configured");
  }
  const res = await fetch(`${cachedBase}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errJson = await res.json();
      detail = errJson.detail || detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function pingBackend(url) {
  const base = normalize(url || cachedBase);
  if (!base) return { ok: false, reason: "no-url" };
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: `http ${res.status}` };
    const data = await res.json();
    return { ok: Boolean(data?.ok), raw: data };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

export async function createNetworkRoom({ mode, playerId, playerName, deck }) {
  return request("/rooms", {
    method: "POST",
    body: { mode, player_id: playerId, player_name: playerName, deck },
  });
}

export async function joinNetworkRoom({ code, playerId, playerName, deck }) {
  return request("/rooms/join", {
    method: "POST",
    body: { code, player_id: playerId, player_name: playerName, deck },
  });
}

export async function fetchNetworkRoom(roomId) {
  return request(`/rooms/${roomId}`);
}

export async function listNetworkRooms() {
  const data = await request(`/rooms?status=waiting`);
  return data?.rooms || [];
}

export async function pushNetworkState(roomId, { gameState, turn, activePlayer, winnerId, status }) {
  return request(`/rooms/${roomId}/state`, {
    method: "POST",
    body: {
      game_state: gameState,
      turn,
      active_player: activePlayer,
      winner_id: winnerId,
      status,
    },
  });
}

export async function pushNetworkAction(roomId, action) {
  return request(`/rooms/${roomId}/action`, {
    method: "POST",
    body: { action },
  });
}

/**
 * Open a WebSocket to a room and invoke `onRoom` with each snapshot.
 * Returns a disposer that closes the socket and halts reconnection.
 */
export function subscribeNetworkRoom(roomId, onRoom) {
  if (!cachedBase) return () => {};
  const url = wsUrlFor(`/rooms/${roomId}/ws`);

  let socket = null;
  let disposed = false;
  let reconnectTimer = null;
  let pingTimer = null;

  const connect = () => {
    try {
      socket = new WebSocket(url);
    } catch (err) {
      scheduleReconnect();
      return;
    }

    socket.addEventListener("message", (event) => {
      if (disposed) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "room" && msg.room) onRoom(msg.room);
      } catch {
        /* ignore malformed payloads */
      }
    });

    socket.addEventListener("close", () => {
      if (!disposed) scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      try {
        socket?.close();
      } catch {
        /* ignore */
      }
    });
    socket.addEventListener("open", () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        try {
          socket?.send(JSON.stringify({ type: "ping" }));
        } catch {
          /* ignore */
        }
      }, 15000);
    });
  };

  const scheduleReconnect = () => {
    if (disposed) return;
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 1500);
  };

  connect();

  return () => {
    disposed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearInterval(pingTimer);
    try {
      socket?.close();
    } catch {
      /* ignore */
    }
  };
}
