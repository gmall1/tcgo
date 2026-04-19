// ============================================================
// Battle Pass System — Seasonal progression rewards
// ============================================================

export const BATTLE_PASS_TIERS = {
  free: {
    name: "Free Battle Pass",
    cost: 0,
    currency: "free",
    maxLevel: 50,
    description: "Free seasonal rewards",
  },
  premium: {
    name: "Premium Battle Pass",
    cost: 1200,
    currency: "tokens",
    maxLevel: 100,
    description: "Unlock all seasonal rewards + bonus levels",
  },
};

export const BATTLE_PASS_REWARDS = {
  free: {
    5: { tokens: 100, description: "100 Tokens" },
    10: { cards: 1, description: "1 Random Card" },
    15: { tokens: 150, description: "150 Tokens" },
    20: { tokens: 200, description: "200 Tokens" },
    25: { cards: 2, description: "2 Random Cards" },
    30: { tokens: 250, description: "250 Tokens" },
    35: { tokens: 300, description: "300 Tokens" },
    40: { cards: 3, description: "3 Random Cards" },
    45: { tokens: 350, description: "350 Tokens" },
    50: { specialCard: true, description: "Exclusive Card" },
  },
  premium: {
    5: { tokens: 150, description: "150 Tokens" },
    10: { cards: 2, description: "2 Random Cards" },
    15: { tokens: 200, description: "200 Tokens" },
    20: { tokens: 250, description: "250 Tokens" },
    25: { cards: 3, description: "3 Random Cards + Booster" },
    30: { tokens: 300, description: "300 Tokens" },
    35: { tokens: 350, description: "350 Tokens" },
    40: { cards: 4, description: "4 Random Cards" },
    45: { tokens: 400, description: "400 Tokens" },
    50: { specialCard: true, description: "Exclusive Card" },
    55: { tokens: 500, description: "500 Tokens" },
    60: { cards: 5, description: "5 Random Cards" },
    65: { tokens: 550, description: "550 Tokens" },
    70: { tokens: 600, description: "600 Tokens" },
    75: { cards: 6, description: "6 Random Cards" },
    80: { tokens: 650, description: "650 Tokens" },
    85: { tokens: 700, description: "700 Tokens" },
    90: { cards: 7, description: "7 Random Cards" },
    95: { tokens: 750, description: "750 Tokens" },
    100: { legendaryCard: true, description: "Legendary Card" },
  },
};

export function createBattlePass(tier = "free") {
  const config = BATTLE_PASS_TIERS[tier] || BATTLE_PASS_TIERS.free;
  return {
    tier,
    level: 1,
    experience: 0,
    maxLevel: config.maxLevel,
    claimedRewards: [],
    startDate: Date.now(),
    endDate: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
    isPremium: tier === "premium",
  };
}

export function addBattlePassExperience(battlePass, amount = 100) {
  const expPerLevel = 1000;
  battlePass.experience += amount;

  while (battlePass.experience >= expPerLevel && battlePass.level < battlePass.maxLevel) {
    battlePass.experience -= expPerLevel;
    battlePass.level++;
  }

  return battlePass;
}

export function getAvailableReward(battlePass) {
  const rewardTable = battlePass.isPremium ? BATTLE_PASS_REWARDS.premium : BATTLE_PASS_REWARDS.free;
  const reward = rewardTable[battlePass.level];

  if (!reward || battlePass.claimedRewards.includes(battlePass.level)) {
    return null;
  }

  return { level: battlePass.level, ...reward };
}

export function claimReward(battlePass, level) {
  if (!battlePass.claimedRewards.includes(level)) {
    battlePass.claimedRewards.push(level);
  }
  return battlePass;
}

export function getSeasonProgress(battlePass) {
  const totalDays = 90;
  const elapsedDays = Math.floor((Date.now() - battlePass.startDate) / (24 * 60 * 60 * 1000));
  const daysRemaining = Math.max(0, totalDays - elapsedDays);
  const progress = Math.min(100, (elapsedDays / totalDays) * 100);

  return { elapsedDays, daysRemaining, totalDays, progress };
}

export function resetBattlePass() {
  // Called when a season ends
  return createBattlePass("free");
}
