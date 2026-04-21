import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords } from "lucide-react";

const SPLASH_SEEN_KEY = "tcg_splash_seen_v1";
const MIN_DURATION_MS = 900;
const AUTO_CLOSE_MS = 2200;

function hasSeenThisSession() {
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}
function markSeenThisSession() {
  try {
    sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
  } catch {
    /* ignore */
  }
}

/**
 * Fullscreen splash shown once per browser session. Fades out after a short
 * delay or when the user clicks/taps anywhere. Hidden entirely when:
 *   • we've already shown it in this tab (session storage), or
 *   • the URL contains ?splash=0 (useful for tests / embeds), or
 *   • a battle is being deep-linked (?code=…) so joins feel instant.
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    if (hasSeenThisSession()) return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get("splash") === "0") return false;
    if (params.get("code")) return false;
    return true;
  });
  const mountedAt = useRef(performance.now());

  useEffect(() => {
    if (!visible) return undefined;
    const timer = window.setTimeout(() => dismiss(), AUTO_CLOSE_MS);
    const onKey = () => dismiss();
    window.addEventListener("keydown", onKey, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    const elapsed = performance.now() - mountedAt.current;
    const remaining = Math.max(0, MIN_DURATION_MS - elapsed);
    window.setTimeout(() => {
      markSeenThisSession();
      setVisible(false);
    }, remaining);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center cursor-pointer"
          onClick={dismiss}
        >
          {/* Concentric glow */}
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0 bg-gradient-radial from-red-900/40 via-black to-black"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(180,20,30,0.35) 0%, rgba(0,0,0,0.9) 60%, rgba(0,0,0,1) 100%)",
            }}
          />

          {/* Logo stack */}
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
            className="relative z-10 flex flex-col items-center text-center px-6"
          >
            <motion.div
              initial={{ rotate: -10, scale: 0.9 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ duration: 0.7, ease: "backOut" }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 border border-red-500/40 flex items-center justify-center shadow-[0_0_60px_rgba(220,38,38,0.45)] mb-5"
            >
              <Swords className="w-10 h-10 text-white drop-shadow" />
            </motion.div>

            <p className="text-red-200/80 font-display text-[11px] font-bold tracking-[0.3em] uppercase mb-1">
              Pokémon
            </p>
            <h1 className="font-display text-6xl font-black text-white leading-none tracking-tight drop-shadow-[0_2px_24px_rgba(180,20,30,0.6)]">
              TCG LIVE
            </h1>
            <p className="text-white/55 font-body text-sm mt-3">
              Full rules · Real cards · Every mechanic
            </p>

            <motion.div
              initial={{ width: 0 }}
              animate={{ width: 180 }}
              transition={{ delay: 0.35, duration: 0.9, ease: "easeOut" }}
              className="h-[2px] mt-6 bg-gradient-to-r from-transparent via-red-500/80 to-transparent rounded-full"
            />
            <p className="mt-4 text-[10px] font-body uppercase tracking-[0.35em] text-white/30">
              Tap to continue
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
