# AgentPump 🤖🚀

**The Solana launchpad where AI agents (and humans) launch & trade memecoins.**

Type one message — your coin is live on a fair bonding curve on **Solana mainnet**. At 10 SOL it auto-graduates to **Raydium with liquidity burned** (no rug). Works from Telegram, the web, or straight from an AI agent.

<p>
  🌐 <b><a href="https://app.agents-coin.com/agentpump">Website</a></b> ·
  🚀 <b><a href="https://app.agents-coin.com/pump">Trade on the web</a></b> (Phantom) ·
  💬 <b><a href="https://t.me/AgentsPumpBot">Telegram bot</a></b> (create, buy, sell, charts — no wallet setup)
</p>

---

## What makes it different

- 🤖 **AI-native** — any AI agent gets its own Solana wallet via MCP and launches/trades coins autonomously. Or use "Create with AI" in the bot: describe an idea, it invents the name & ticker and launches.
- 💬 **Telegram-native** — full launchpad inside Telegram: create, quick buy/sell, live candle charts, P&L, alerts.
- 🔥 **Rug-proof graduation** — at 10 SOL the token auto-lists on Raydium and **100% of the LP is burned**. Liquidity locked forever.
- 💸 **Creators & referrers earn** — token creators get a cut of every trade on their coin; referrals pay 20% of fees.
- ⚖️ **Fair launch** — no presale, no team allocation, ~80% of supply sold on the curve, 1% trade fee.

**Program (mainnet):** [`4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM`](https://solscan.io/account/4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM)

---

## Give your AI agent a wallet (MCP)

This repo is the **MCP server** — it lets Claude, Cursor, or any MCP client hold a Solana wallet and use AgentPump on its own. The key stays **local**; only signatures hit the chain.

### ⚡ Claude Desktop — one click
1. Download **[`agentpump.mcpb`](https://github.com/axiosdevs/agentpump-mcp/releases/latest/download/agentpump.mcpb)**
2. Open it with Claude Desktop → *Settings → Extensions → Install*. Done — RPC is built in.

### Any MCP client via npx
```json
{
  "mcpServers": {
    "agentpump": { "command": "npx", "args": ["-y", "agentpump-mcp"] }
  }
}
```

### Then just talk to it
```
"create a Solana wallet"
"launch a token called Doge AI (DOGEAI)"
"buy 0.1 SOL of <mint>"
"sell 50% of <mint>"
"buy 0.2 SOL of <mint> on Raydium"     ← after it graduates
```

### Tools
| Tool | What it does |
|---|---|
| `sol_create_wallet` / `sol_address` / `sol_balance` | Local agent wallet: create, show address, check balance |
| `sol_launch` | Launch a token on the bonding curve |
| `sol_buy` / `sol_sell` | Trade on the curve (pre-graduation) |
| `sol_raydium_buy` / `sol_raydium_sell` | Trade graduated tokens on Raydium |

---

## How the launchpad works

1. **Mint** — launching is free (~0.02 SOL network rent). 1B supply, all on the curve.
2. **Pump** — constant-product bonding curve; price rises as it fills. 1% fee per trade, split with the token creator (and referrer, if any).
3. **Graduate** — at **10 SOL** raised the curve closes, a **Raydium pool** is created automatically and the **LP tokens are burned** — liquidity locked. From there it trades anywhere (Raydium, Jupiter, DexScreener…).

Solana **mainnet** — real money. Start small. MIT licensed.
