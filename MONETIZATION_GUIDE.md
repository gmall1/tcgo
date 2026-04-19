# Monetization System Guide

## Overview

Your game now has **three revenue streams**:
1. **Pack Shop** — Players buy booster packs with tokens (cosmetic currency)
2. **Battle Pass** — Seasonal progression system with free and premium tiers
3. **Premium Tier** — Donation-based all-cards access

All systems are designed to be **fair and fun**, not pay-to-win.

---

## 1. Pack Shop (`/pack-shop`)

### How it works
- Players earn **tokens** through the battle pass and battles
- They spend tokens to open **booster packs**
- Each pack contains random cards with rarity tiers

### Pack types
| Pack | Cards | Cost | Guarantee | Best for |
|------|-------|------|-----------|----------|
| Starter | 5 | 500 tokens | 1 Rare | New players |
| Standard | 10 | 1000 tokens | 1 Uncommon + 1 Rare | Building decks |
| Deluxe | 15 | 1500 tokens | 2 Rare + 1 Holo Rare | Collectors |
| Premium | 20 | 2500 tokens | 1 Holo Rare + 1 Ultra Rare | Whales |

### Rarity distribution
- **Common**: 50%
- **Uncommon**: 25%
- **Rare**: 15%
- **Holo Rare**: 7%
- **Ultra Rare**: 2%
- **Secret Rare**: 1%

### Revenue model
- Free players: slow progression, incentivized to buy premium
- Premium players: earn tokens monthly, sustained engagement
- Casual players: happy with free cards from battle pass

---

## 2. Battle Pass (`/battle-pass`)

### How it works
- Seasonal 90-day pass with 50 (free) or 100 (premium) levels
- Earn experience by playing battles
- Unlock rewards at each level: tokens, cards, exclusive items

### Free tier rewards (50 levels)
- Mix of tokens (100-350 per level)
- Random cards
- One exclusive card at level 50

### Premium tier rewards (100 levels)
- Higher token payouts (150-750)
- More cards per level
- Exclusive card at level 50
- Legendary card at level 100
- Costs **1200 tokens** to unlock (or real money donation)

### Revenue model
- Free players: feel engaged, earn small rewards
- Premium players: feel valued, get more rewards
- Seasonal reset: players return every 3 months

---

## 3. Premium Tier (`/premium`)

### Tiers and pricing

#### Supporter ($5/month)
- All cards access (build with any card immediately)
- Premium battle pass (100 levels, better rewards)
- +5 custom deck slots
- No ads
- Monthly: 500 tokens + 2 packs

#### Champion ($15/month)
- All cards + future cards access
- Premium battle pass
- +10 custom deck slots
- Priority matchmaking
- Exclusive cosmetics
- Monthly: 1500 tokens + 5 packs + 1 exclusive card

### Key design
- **Not pay-to-win**: Card power level is same for all players
- **All cards access**: Saves time grinding, preserves fun
- **Fair advantage**: Only speeds up progression, doesn't add power
- **Optional**: Game is fully playable free

---

## Revenue Strategy

### Month 1-3: Launch
- Focus on **battle pass** for engagement metrics
- Pack shop generates awareness
- Premium tier for early supporters

### Month 4-6: Growth
- Seasonal battle passes keep players returning
- Pack shop drives cosmetic revenue
- Premium sponsorships from charitable organizations

### Month 6+: Mature
- Stable revenue from premium subscribers
- Battle pass purchases from free players
- Community tournaments with prize pools

---

## Implementation Checklist

### Pack Shop (`/pack-shop`)
- ✅ Pack types defined in `packSystem.js`
- ✅ Pull animation in UI
- ✅ Rarity distribution weighted correctly
- ❌ Real token economy (need backend)
- ❌ Duplicate card handling (trade-in value)

### Battle Pass (`/battle-pass`)
- ✅ Free and premium tiers
- ✅ Level progression system
- ✅ Reward tables defined
- ✅ Season timer (90 days)
- ❌ Real XP from battles (need Battle.jsx integration)
- ❌ Backend persistence (need database)

### Premium (`/premium`)
- ✅ Tier comparison cards
- ✅ All cards access logic
- ✅ Monthly reward tiers
- ❌ Real donation integration (Stripe/PayPal)
- ❌ Subscription management
- ❌ Auto-renew handling

---

## How to integrate with real payments

### For Pack Shop:
```javascript
// In PackShop.jsx, when user clicks "Open pack"
const handlePayment = async (packType) => {
  const config = PACK_TYPES[packType];
  
  // Call Stripe or PayPal
  const { sessionId } = await fetch('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ packType, amount: config.cost })
  }).then(r => r.json());
  
  // Redirect to payment
  window.location.href = `https://checkout.stripe.com/pay/${sessionId}`;
};
```

### For Battle Pass:
```javascript
// In BattlePass.jsx, when user clicks "Upgrade to premium"
const handleBattlePassPurchase = async () => {
  const { sessionId } = await fetch('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({ item: 'battle-pass-premium', amount: 1200 })
  }).then(r => r.json());
  
  window.location.href = `https://checkout.stripe.com/pay/${sessionId}`;
};
```

### For Premium:
```javascript
// In Premium.jsx, when user clicks "Become a supporter"
const handleDonation = (tier) => {
  const amounts = { supporter: 500, champion: 1500 }; // in cents
  
  // Open donation modal or redirect to charity donation page
  window.open(
    `https://donate.example.com/${tier}?amount=${amounts[tier]}&ref=tcg`,
    '_blank'
  );
};
```

---

## Free players should feel...
- Competitive (same card power as premium)
- Rewarded (earn stuff from battles and pass)
- Engaged (seasonal content keeps returning)
- Not punished (no paywalls, no FOMO)

## Premium players should feel...
- Supported (donations help game dev)
- Valued (exclusive rewards)
- Efficient (saved grinding time)
- Special (cosmetics, priority matchmaking)

---

## Monitoring & Metrics

Track:
1. **Daily Active Users (DAU)** — total players
2. **Free → Premium Conversion** — % who upgrade
3. **Average Revenue Per User (ARPU)** — revenue ÷ players
4. **Lifetime Value (LTV)** — total revenue from one player
5. **Churn Rate** — % who stop playing

Example targets:
- 3% conversion rate (3 of 100 free players upgrade)
- $3 ARPU in month 1
- $15 LTV for premium player
- <5% monthly churn

---

## Legal notes

If donations go to an unrelated fund:
1. **Be transparent**: Clearly state where money goes
2. **Separate accounts**: TCG fund ≠ charity fund
3. **Terms of service**: Explain refund policy
4. **Compliance**: Check payment processor rules

Stripe/PayPal typically require:
- Clear refund policy
- Terms of service
- Privacy policy
- Business address
- Tax ID (for donations)

---

## Your job

1. Set real donation URLs (replace `https://donate.example.com/...`)
2. Integrate with Stripe, PayPal, or donation platform
3. Add backend to persist purchases
4. Test payments with sandbox accounts
5. Monitor metrics and adjust pricing if needed

Start small — you can always add more tiers and features later!

