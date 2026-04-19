import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function GameModeCard({ title, description, icon, gradient, link, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: "easeOut" }}
    >
      <Link to={link}>
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 min-h-[180px] flex flex-col justify-between cursor-pointer group`}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-10 translate-x-10 group-hover:scale-150 transition-transform duration-700" />
          <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
          
          <div className="text-4xl mb-3">{icon}</div>
          
          <div>
            <h3 className="font-display text-xl font-bold text-white mb-1">{title}</h3>
            <p className="text-white/70 text-sm font-body leading-relaxed">{description}</p>
          </div>

          <div className="absolute bottom-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <span className="text-white text-lg">→</span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}