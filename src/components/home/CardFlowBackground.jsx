import React, { useMemo } from "react";
import { LOCAL_CATALOG_CARDS } from "@/lib/cardCatalog";

/**
 * Full-bleed animated background: a tilted, slowly drifting grid of real TCG
 * card art, washed in a magenta/crimson gradient with a subtle halftone
 * pattern and a satin wave overlay.
 *
 * Usage: drop inside any position:relative parent — it fills it.
 *
 * Variants:
 *   - "cards": drifting Pokémon card collage (Home hero).
 *   - "satin": just the pink satin waves + halftone (Battle field). Cheaper,
 *     doesn't distract from board state.
 */
export default function CardFlowBackground({
  density = 24,
  tint = "magenta",
  variant = "cards",
  intensity = 1,
}) {
  const cards = useMemo(() => {
    if (variant !== "cards") return [];
    const pool = LOCAL_CATALOG_CARDS.filter(
      (c) => c.card_type === "pokemon" && c.image_small,
    );
    const out = [];
    let i = 0;
    while (out.length < density) {
      out.push(pool[i % pool.length] || null);
      i += 1;
    }
    return out.filter(Boolean);
  }, [density, variant]);

  // Default tint is a deep crimson → black fade. `crimson` kept as an alias
  // for older callers so existing props don't break.
  const tintGradient =
    tint === "ember"
      ? "from-red-800/80 via-red-950/85 to-black/90"
      : "from-red-950/90 via-black/80 to-red-900/70";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* 1. Drifting card collage (cards variant only) */}
      {variant === "cards" && (
        <div className="absolute inset-0 [transform:rotate(-8deg)_scale(1.3)] origin-center">
          <div
            className="absolute -inset-[30%] grid gap-3 opacity-[0.7] card-flow-drift"
            style={{ gridTemplateColumns: "repeat(6, minmax(0, 1fr))" }}
          >
            {[...cards, ...cards].map((c, i) => (
              <img
                key={`${c.id}-${i}`}
                src={c.image_small}
                alt=""
                loading="lazy"
                draggable={false}
                className="w-full aspect-[2.5/3.5] object-contain"
                style={{ transform: `translateY(${(i % 3) * 18}px)` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* 2. Magenta / crimson gradient wash */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${tintGradient} mix-blend-multiply`}
        style={{ opacity: intensity }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />

      {/* 3. Satin highlight waves */}
      <svg
        className="absolute inset-0 w-full h-full opacity-40 mix-blend-screen card-flow-waves"
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="satin" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0" />
            <stop offset="45%" stopColor="#7f1d1d" stopOpacity="0.55" />
            <stop offset="55%" stopColor="#450a0a" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M -200 480 C 200 320, 600 640, 1000 380 S 1500 520, 1600 380 L 1600 900 L -200 900 Z"
          fill="url(#satin)"
        />
        <path
          d="M -200 580 C 300 480, 700 720, 1100 500 S 1600 640, 1700 500 L 1700 900 L -200 900 Z"
          fill="url(#satin)"
          opacity="0.6"
        />
        <path
          d="M -200 320 C 250 220, 650 460, 1050 260 S 1550 400, 1700 260 L 1700 0 L -200 0 Z"
          fill="url(#satin)"
          opacity="0.35"
        />
      </svg>

      {/* 4. Halftone dots */}
      <div
        className="absolute inset-0 opacity-40 mix-blend-soft-light"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.35) 1px, transparent 1.4px)",
          backgroundSize: "6px 6px",
        }}
      />

      {/* 5. Edge vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.55)_100%)]" />
    </div>
  );
}
