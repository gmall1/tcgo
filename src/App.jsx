import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { queryClientInstance } from "@/lib/query-client";
import { AuthProvider } from "@/lib/AuthContext";
import PageNotFound from "@/lib/PageNotFound";
import SplashScreen from "@/components/SplashScreen";
import { seedPremadeDecks } from "@/lib/premadeDecks";
import Home from "@/pages/Home";
import Collection from "@/pages/Collection";
import Decks from "@/pages/Decks";
import DeckBuilder from "@/pages/DeckBuilder";
import Lobby from "@/pages/Lobby";
import Battle from "@/pages/Battle";
import Admin from "@/pages/Admin";
import AIDeckBuilder from "@/pages/AIDeckBuilder";
import DeckShare from "@/pages/DeckShare";
import CardMechanicFactory from "@/pages/CardMechanicFactory";
import SoundAdmin from "@/pages/SoundAdmin";
import PackShop from "@/pages/PackShop";
import BattlePass from "@/pages/BattlePass";
import Premium from "@/pages/Premium";
import MechanicStudio from "@/pages/MechanicStudio";
import MechanicBuilder from "@/pages/MechanicBuilder";
import { registerAllSavedCardMechanics } from "@/lib/cardMechanicConfigs";

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/collection" element={<Collection />} />
      <Route path="/decks" element={<Decks />} />
      <Route path="/deck-builder" element={<DeckBuilder />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/battle" element={<Battle />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="/ai-deck-builder" element={<AIDeckBuilder />} />
      <Route path="/deck-share" element={<DeckShare />} />
      <Route path="/card-mechanic-factory" element={<CardMechanicFactory />} />
      <Route path="/sound-admin" element={<SoundAdmin />} />
      <Route path="/pack-shop" element={<PackShop />} />
      <Route path="/battle-pass" element={<BattlePass />} />
      <Route path="/premium" element={<Premium />} />
      <Route path="/mechanic-studio" element={<MechanicStudio />} />
      <Route path="/mechanic-builder" element={<MechanicBuilder />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

try {
  seedPremadeDecks();
} catch (err) {
  console.warn("Failed to seed premade decks", err);
}

try {
  registerAllSavedCardMechanics();
} catch (err) {
  console.warn("Failed to register saved card mechanics", err);
}

export default function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppRoutes />
        </Router>
        <SplashScreen />
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}
