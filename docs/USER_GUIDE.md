# Dispute Resolution System - User Guide

## What Is This?

Imagine you bet on a prediction market: *"Will it rain tomorrow?"* 

The market says "Yes" won, but you saw sunshine all day. Something's wrong! 

**The Dispute Resolution System lets you challenge incorrect market outcomes** and get them fixed — with the help of the community.

---

## Why Does This Matter?

Prediction markets only work if outcomes are **accurate and trustworthy**. Without a way to challenge mistakes, bad actors could manipulate results and steal money.

Our system creates a **community-powered check** on market outcomes. If something looks wrong, anyone can raise a dispute, and token holders vote to decide the truth.

**Think of it like a jury system for prediction markets.**

---

## How It Works (The Simple Version)

### Step 1: Lock Your Tokens

To participate in disputes, you first need to **lock your ANON tokens** for 1 year. This shows you have skin in the game and aren't just trying to manipulate votes.

When you lock tokens, you receive a **Voting NFT** that represents your voting power. The more tokens you lock, the stronger your vote.

### Step 2: Someone Opens a Dispute

When a market result looks wrong, anyone can **open a dispute** by:
- Putting up collateral (a deposit that shows they're serious)
- Explaining why they think the result is wrong
- Proposing what the correct answer should be

The required deposit is based on the market size — bigger markets need bigger deposits.

### Step 3: Community Votes

Once a dispute is open, **voting begins**. Token holders use their Voting NFTs to cast votes:

| Vote | Meaning |
|------|---------|
| **Yes** | The original market result was correct |
| **No** | The market result was wrong |
| **Unknown** | The outcome cannot be determined |

You can vote on disputes happening on **any supported blockchain** without moving your tokens around. Your voting power travels with you across chains!

### Step 4: Resolution

After the voting period ends, the votes are counted:

- **Majority wins** — whichever option got the most votes determines the final outcome
- **Tie = Failed** — if votes are split evenly, the dispute fails and the original result stands

### Step 5: Rewards Are Distributed

Here's where it gets interesting:

**If the disputer was RIGHT:**
- They get their deposit back
- The market outcome is corrected

**If the disputer was WRONG:**
- Their deposit is distributed to voters as rewards
- 80% goes to voters (proportional to voting power)
- 20% goes to the protocol

---

## How Lockers Make Money

### Earn By Voting

Every time you vote on a dispute, you're eligible for rewards:

```
Your Reward = (Your Voting Power / Total Votes) × 80% of Deposit
```

**Example:**
- A dispute has a 10,000 USDC deposit
- Total voting power: 1,000,000
- Your voting power: 50,000 (5% of total)
- Your reward: 5% × 8,000 USDC = **400 USDC**

The more disputes you vote on, the more you earn!

### Earn Staking Rewards

Your locked tokens continue earning staking rewards even while they're being used for voting. You don't have to choose between staking yields and dispute rewards — you get both.

### Multiple Revenue Streams

| Income Source | How It Works |
|---------------|--------------|
| **Dispute Rewards** | Earn from voting on incorrect outcomes |
| **Staking Yields** | Base rewards from locking tokens |
| **Cross-Chain Voting** | Vote on disputes across all supported chains |

---

## Why This System Is Awesome

### 1. Trustless Verification

No single person or company decides if a market outcome is correct. The **community decides collectively**, making manipulation nearly impossible.

### 2. Economic Incentives Aligned

- **Disputers** must put up real money, so they only dispute when they're confident
- **Voters** earn rewards for participating honestly
- **Bad actors** lose money when they try to manipulate

### 3. Cross-Chain Magic

Your voting power works **across multiple blockchains**. A market on Base got the wrong answer? Vote from Sonic without bridging anything. Your tokens stay safe at home while your vote travels.

### 4. Proportional Power

Bigger stakers have more voting power, but everyone can participate. This means:
- Large holders are incentivized to protect the system (they have the most to lose)
- Smaller holders can still earn meaningful rewards

### 5. Time-Tested Security

The system uses **LayerZero** — battle-tested technology that secures billions of dollars in cross-chain transactions. Multiple security verifiers must confirm every message.

---

## How The System Prevents Abuse

### Protection #1: Deposit Requirements

Opening a dispute costs real money. The deposit scales with market size:

| Market TVL | Minimum Deposit |
|------------|-----------------|
| $100,000 | $1,000 |
| $1,000,000 | $10,000 |
| $10,000,000 | $100,000 |

**Why this works:** Frivolous disputes become expensive. You won't dispute a market unless you're confident you're right.

### Protection #2: Voting Lockups

After you vote, your tokens are **locked for 60 hours**. This prevents:
- Voting, then selling tokens to vote again
- Flash loan attacks (borrowing tokens just to vote)
- Quick exit after manipulation attempts

### Protection #3: Staking Requirements

Only **1-year locked tokens** can vote. This means:
- Voters have long-term skin in the game
- Short-term speculators can't influence outcomes
- The community consists of committed participants

### Protection #4: Double-Vote Prevention

Each Voting NFT can only vote **once per dispute**. No matter how many wallets you have, one NFT = one vote.

### Protection #5: Penalty System

Operators can penalize bad actors by **blocking their NFTs**. Blocked tokens cannot:
- Vote on any dispute
- Be transferred to other wallets
- Be unlocked

This creates a permanent record of misbehavior.

### Protection #6: Multi-Chain Verification

Cross-chain votes are verified by **two independent security networks** (LayerZero Labs and Nethermind). Both must agree the message is legitimate before it's processed.

---

## Real World Example

**The Scenario:**

A prediction market asks: *"Will ETH be above $4,000 on December 31st?"*

ETH closes at $4,127 on December 31st, but the oracle reports "No" (below $4,000) due to a data feed error. People who bet "Yes" are about to lose money unfairly.

**What Happens:**

1. **Alice notices the error** and opens a dispute
   - She deposits $10,000 (1% of the $1M market)
   - She proposes the answer should be "Yes"

2. **Community votes over 2 hours**
   - Bob votes "Yes" with 100,000 voting power
   - Carol votes "Yes" with 50,000 voting power  
   - Dave votes "No" with 20,000 voting power (maybe he's confused)

3. **Dispute resolves**
   - "Yes" wins with 150,000 vs 20,000 votes
   - The market outcome is corrected to "Yes"
   - Alice gets her $10,000 deposit back

4. **Rewards distributed**
   - Bob earns: (100,000 / 170,000) × $8,000 = **$4,706**
   - Carol earns: (50,000 / 170,000) × $8,000 = **$2,353**
   - Dave earns: (20,000 / 170,000) × $8,000 = **$941**
   - Protocol receives: **$2,000**

**Everyone who voted gets paid**, even Dave who voted wrong. The reward is for participating and helping secure the network.

---

## Getting Started

### For Token Holders

1. **Lock your ANON tokens** for 1 year
2. **Receive your Voting NFT** automatically
3. **Watch for disputes** on markets you care about
4. **Vote honestly** and earn rewards
5. **Claim your rewards** after disputes resolve

### For Disputers

1. **Find a market** with an incorrect outcome
2. **Check the required deposit** (market TVL / 100)
3. **Open the dispute** with your proposed correction
4. **Wait for community vote**
5. **Get your deposit back** if you were right

---

## Frequently Asked Questions

### How much can I earn?

It depends on:
- How many disputes you vote on
- The size of dispute deposits
- Your voting power relative to others

Active voters in busy markets can earn **significant passive income** just by participating in governance.

### What if I vote "wrong"?

You still earn rewards! Rewards are distributed to **all voters**, not just the winning side. The system rewards participation, not prediction.

### Can I lose my locked tokens?

Your underlying tokens are **always safe**. The only way to lose value is if you're penalized for provable malicious behavior. Normal voting carries no risk of loss.

### How long are tokens locked?

- **Initial lock:** 1 year minimum
- **After voting:** Additional 60-hour cooldown before unlocking
- **After disputes:** Tokens unlock normally once cooldowns pass

### What chains are supported?

Currently:
- **Sonic** (Home chain — where tokens are locked)
- **Base** (Remote chain — where you can vote on disputes)

More chains coming soon!

---

## The Bottom Line

The Dispute Resolution System creates a **fair, decentralized way** to ensure prediction market accuracy. By locking tokens and voting honestly, you:

- **Protect the integrity** of prediction markets
- **Earn rewards** for your participation  
- **Help build** a more trustworthy prediction ecosystem

Your voice matters. Your vote counts. And you get paid for both.

---

*Questions? Join our community channels to learn more and connect with other participants.*













