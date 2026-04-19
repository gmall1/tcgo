import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Layers, FolderOpen, Users, Settings, Trophy } from "lucide-react";

const navItems = [
  { path: "/", icon: Home, label: "Home" },
  { path: "/collection", icon: Layers, label: "Cards" },
  { path: "/decks", icon: FolderOpen, label: "Decks" },
  { path: "/lobby", icon: Users, label: "Play" },
  { path: "/leaderboard", icon: Trophy, label: "Rank" },
  { path: "/admin", icon: Settings, label: "Admin" },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-4 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || 
            (item.path !== "/" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors
                ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? "text-primary" : ""}`} />
              <span className={`text-[10px] font-body font-medium ${isActive ? "text-primary" : ""}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}