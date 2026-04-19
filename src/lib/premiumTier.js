// ============================================================
// Premium Tier — Donation-based all-cards access
// ============================================================

export const PREMIUM_TIERS = {
  free: {
    name: "Free Player",
    cost: 0,
    perks: ["Limited card access", "Free battle pass"],
    allCardsAccess: false,
  },
  supporter: {
    name: "Supporter",
    cost: 5,
    currency: "USD",
    perks: ["All cards access", "Premium battle pass", "Custom deck slots +5", "No ads"],
    allCardsAccess: true,
    monthlyRewards: { tokens: 500, packs: 2 },
  },
  champion: {
    name: "Champion",
    cost: 15,
    currency: "USD",
    perks: ["All cards + future cards", "Premium battle pass", "Custom deck slots +10", "Priority matchmaking", "Exclusive cosmetics"],
    allCardsAccess: true,
    monthlyRewards: { tokens: 1500, packs: 5, specialCards: 1 },
  },
};

export function getUserPremiumStatus() {
  const saved = localStorage.getItem("user-premium-tier");
  if (!saved) {
    return {
      tier: "free",
      allCardsUnlocked: false,
      activeSince: null,
      expiresAt: null,
    };
  }

  const status = JSON.parse(saved);
  // Check if subscription expired
  if (status.expiresAt && Date.now() > status.expiresAt) {
    return {
      tier: "free",
      allCardsUnlocked: false,
      activeSince: null,
      expiresAt: null,
    };
  }

  return status;
}

export function setPremiumTier(tier, durationMonths = 1) {
  if (!PREMIUM_TIERS[tier]) {
    throw new Error(`Invalid tier: ${tier}`);
  }

  const status = {
    tier,
    allCardsUnlocked: PREMIUM_TIERS[tier].allCardsAccess,
    activeSince: Date.now(),
    expiresAt: Date.now() + durationMonths * 30 * 24 * 60 * 60 * 1000,
    autoRenew: true,
  };

  localStorage.setItem("user-premium-tier", JSON.stringify(status));
  return status;
}

export function getDonationLink(tier) {
  // In production, integrate with actual donation service (Stripe, PayPal, etc.)
  const links = {
    supporter: "https://donate.example.com/supporter",
    champion: "https://donate.example.com/champion",
  };
  return links[tier] || null;
}

export function hasAllCardsAccess() {
  const status = getUserPremiumStatus();
  return status.allCardsUnlocked;
}

export function getRemainingDays() {
  const status = getUserPremiumStatus();
  if (!status.expiresAt) return 0;
  const remaining = Math.ceil((status.expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
  return Math.max(0, remaining);
}

export function getMonthlyReward() {
  const status = getUserPremiumStatus();
  const config = PREMIUM_TIERS[status.tier];
  return config?.monthlyRewards || null;
}
