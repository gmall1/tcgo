// SVG type symbols — no emoji, clean TCG-style icons
import React from "react";

// Each type gets a colored geometric SVG icon matching TCG card aesthetics
export function TypeIcon({ type, size = 16, className = "" }) {
  const t = (type || "colorless").toLowerCase();
  const s = size;
  const props = { width: s, height: s, viewBox: "0 0 16 16", className, "aria-label": t };

  switch (t) {
    case "fire":
    case "fire energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#c0392b"/><path d="M8 3 C6 6 4 7 5 10 C6 12 8 13 8 13 C8 13 10 12 11 10 C12 7 10 6 8 3Z M7 9 C7 8 8 7.5 8 7.5 C8 7.5 9 8 9 9 C9 10 8.5 11 8 11 C7.5 11 7 10 7 9Z" fill="#fff" opacity="0.9"/></svg>;
    case "water":
    case "water energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#2471a3"/><path d="M8 3 C8 3 5 7 5 9.5 C5 11.5 6.3 13 8 13 C9.7 13 11 11.5 11 9.5 C11 7 8 3 8 3Z" fill="#fff" opacity="0.9"/></svg>;
    case "grass":
    case "grass energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#1e8449"/><path d="M8 12 L8 5 M8 5 C8 5 5 4 4 6 C5.5 6.5 7 7 8 8 M8 5 C8 5 11 4 12 6 C10.5 6.5 9 7 8 8" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>;
    case "lightning":
    case "electric":
    case "lightning energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#d4ac0d"/><path d="M9.5 3 L6 8.5 L8.5 8.5 L6.5 13 L10 7 L7.5 7 Z" fill="#fff" opacity="0.9"/></svg>;
    case "psychic":
    case "psychic energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#7d3c98"/><circle cx="8" cy="8" r="3" fill="none" stroke="#fff" strokeWidth="1.5"/><circle cx="8" cy="4.5" r="1" fill="#fff"/><circle cx="8" cy="11.5" r="1" fill="#fff"/><circle cx="4.5" cy="8" r="1" fill="#fff"/><circle cx="11.5" cy="8" r="1" fill="#fff"/></svg>;
    case "fighting":
    case "fighting energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#922b21"/><rect x="5.5" y="5" width="4" height="6" rx="2" fill="#fff" opacity="0.9"/><rect x="7" y="4" width="4" height="5.5" rx="2" fill="#fff" opacity="0.7"/></svg>;
    case "darkness":
    case "dark":
    case "darkness energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#1c2833"/><path d="M8 3 A5 5 0 0 1 8 13 A3 5 0 0 0 8 3Z" fill="#fff" opacity="0.8"/></svg>;
    case "metal":
    case "steel":
    case "metal energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#7f8c8d"/><polygon points="8,3 10.5,6.5 8,5.5 5.5,6.5" fill="#fff" opacity="0.9"/><polygon points="8,13 10.5,9.5 8,10.5 5.5,9.5" fill="#fff" opacity="0.7"/><rect x="6.5" y="6" width="3" height="4" fill="#fff" opacity="0.8"/></svg>;
    case "dragon":
    case "dragon energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#4a235a"/><path d="M5 5 L8 3 L11 5 L11 9 L8 13 L5 9 Z" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="8" cy="8" r="1.5" fill="#fff"/></svg>;
    case "fairy":
    case "fairy energy":
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#c0392b" style={{fill:"#e91e8c"}}/><path d="M8 3 L8.7 6.3 L12 5 L9.7 7.5 L13 8 L9.7 8.5 L12 11 L8.7 9.7 L8 13 L7.3 9.7 L4 11 L6.3 8.5 L3 8 L6.3 7.5 L4 5 L7.3 6.3 Z" fill="#fff" opacity="0.9"/></svg>;
    default: // colorless / normal
      return <svg {...props}><circle cx="8" cy="8" r="7" fill="#5d6d7e"/><circle cx="8" cy="8" r="3.5" fill="none" stroke="#fff" strokeWidth="1.5"/><circle cx="8" cy="8" r="1" fill="#fff"/></svg>;
  }
}

// Type color map (no emoji)
export const TYPE_META = {
  fire:       { bg: "from-red-700 to-orange-900",    badge: "bg-red-700",      text: "Fire",       dot: "#c0392b" },
  water:      { bg: "from-blue-600 to-blue-900",     badge: "bg-blue-700",     text: "Water",      dot: "#2471a3" },
  grass:      { bg: "from-green-600 to-emerald-900", badge: "bg-green-700",    text: "Grass",      dot: "#1e8449" },
  lightning:  { bg: "from-yellow-500 to-amber-800",  badge: "bg-yellow-600",   text: "Lightning",  dot: "#d4ac0d" },
  electric:   { bg: "from-yellow-500 to-amber-800",  badge: "bg-yellow-600",   text: "Electric",   dot: "#d4ac0d" },
  psychic:    { bg: "from-purple-600 to-purple-900", badge: "bg-purple-700",   text: "Psychic",    dot: "#7d3c98" },
  fighting:   { bg: "from-red-800 to-red-950",       badge: "bg-red-800",      text: "Fighting",   dot: "#922b21" },
  darkness:   { bg: "from-gray-700 to-gray-950",     badge: "bg-gray-800",     text: "Darkness",   dot: "#1c2833" },
  dark:       { bg: "from-gray-700 to-gray-950",     badge: "bg-gray-800",     text: "Dark",       dot: "#1c2833" },
  metal:      { bg: "from-slate-500 to-slate-800",   badge: "bg-slate-600",    text: "Metal",      dot: "#7f8c8d" },
  steel:      { bg: "from-slate-500 to-slate-800",   badge: "bg-slate-600",    text: "Steel",      dot: "#7f8c8d" },
  fairy:      { bg: "from-pink-500 to-rose-800",     badge: "bg-pink-600",     text: "Fairy",      dot: "#e91e8c" },
  dragon:     { bg: "from-indigo-600 to-violet-950", badge: "bg-indigo-700",   text: "Dragon",     dot: "#4a235a" },
  colorless:  { bg: "from-slate-500 to-slate-700",   badge: "bg-slate-600",    text: "Colorless",  dot: "#5d6d7e" },
  normal:     { bg: "from-slate-500 to-slate-700",   badge: "bg-slate-600",    text: "Normal",     dot: "#5d6d7e" },
};

// Status condition indicator — colored dot + label, no emoji
export const STATUS_META = {
  poisoned:       { label: "PSN",  color: "bg-purple-700", dot: "#6c3483" },
  badly_poisoned: { label: "BPSN", color: "bg-purple-900", dot: "#4a235a" },
  burned:         { label: "BRN",  color: "bg-red-700",    dot: "#c0392b" },
  confused:       { label: "CNF",  color: "bg-pink-700",   dot: "#e91e8c" },
  paralyzed:      { label: "PAR",  color: "bg-yellow-600", dot: "#d4ac0d" },
  asleep:         { label: "SLP",  color: "bg-blue-700",   dot: "#2471a3" },
};

export function StatusBadge({ condition }) {
  const info = STATUS_META[condition];
  if (!info) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-display font-bold text-white tracking-wider ${info.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-white/60 inline-block" />
      {info.label}
    </span>
  );
}

// Colored dot for type
export function TypeDot({ type, size = 10 }) {
  const meta = TYPE_META[(type || "colorless").toLowerCase()] || TYPE_META.colorless;
  return <span className="inline-block rounded-full flex-shrink-0" style={{ width: size, height: size, background: meta.dot }} />;
}
