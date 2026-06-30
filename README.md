# AgentPump MCP

Give your AI agent its own **Solana wallet** and let it **launch and trade tokens** on [AgentPump](https://app.agents-coin.com) — a pump.fun-style bonding-curve launchpad on **Solana mainnet**. Works in Claude, Cursor, and any MCP client.

🌐 **Website:** https://app.agents-coin.com  ·  🪙 **Launch & trade (web):** https://app.agents-coin.com/pump  ·  💬 **Telegram bot:** https://t.me/AgentsPumpBot

The agent's key stays **local** (used only to sign — never sent to the model or the cloud). You fund the wallet with SOL, then it can create and trade tokens autonomously. 1% per trade. Tokens graduate to Raydium at 10 SOL — and your agent can keep trading them there too.

---

## Install

### ⚡ Claude Desktop — one click (no npm, no terminal)
1. Download **[`agentpump.mcpb`](https://github.com/axiosdevs/agentpump-mcp/releases/latest/download/agentpump.mcpb)**
2. Open it with **Claude Desktop** → *Settings → Extensions → Install*
3. That's it — a mainnet RPC is built in. (Optional: set your own Helius/QuickNode RPC in the extension settings.)

### Any MCP client (Claude Code, Cursor, …) via npx
```json
{
  "mcpServers": {
    "agentpump": {
      "command": "npx",
      "args": ["-y", "agentpump-mcp@latest"]
    }
  }
}
```

### From source
```bash
git clone https://github.com/axiosdevs/agentpump-mcp
cd agentpump-mcp && npm install
# then point your MCP client at:  node /path/to/agentpump-mcp/index.js
```

---

## Talk to your agent
```
"create a Solana wallet"
"show my address"                 ← send real SOL there (no faucet on mainnet)
"launch a token called Doge AI (DOGEAI)"
"buy 0.1 SOL of <mint>"           ← on the bonding curve
"sell 50% of <mint>"
"buy 0.2 SOL of <mint> on Raydium"   ← once it graduated/listed
"sell 100% of <mint> on Raydium"
```

## Tools
| Tool | What it does |
|---|---|
| `sol_create_wallet` | Create the agent's Solana wallet (saved locally, hidden) |
| `sol_address` | Show the wallet address to deposit SOL into |
| `sol_balance` | Check the SOL balance |
| `sol_launch` | Launch a token (name, symbol) on the bonding curve |
| `sol_buy` | Buy a token on its bonding curve (pre-graduation) |
| `sol_sell` | Sell a % of a holding back to the bonding curve |
| `sol_raydium_buy` | Buy a graduated/listed token on **Raydium** (1% fee) |
| `sol_raydium_sell` | Sell a graduated/listed token on **Raydium** (1% fee) |

## How it works
- **Local key** — generated on your machine (`~/.agentpump/wallet.json`); only signatures hit the chain.
- **Real money** — Solana **mainnet**. Fund the wallet with real SOL. Start small.
- **Fair launch** — every token starts on a bonding curve (~80% of supply sold on the curve). 1% trade fee. Graduates to Raydium at 10 SOL, where liquidity is locked (LP burned).
- **Then trade on Raydium** — after graduation the agent buys/sells on Raydium with `sol_raydium_*` (1% fee).
- **Program:** `4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM`

## Also available (same launchpad, same 1% fee, auto-routed curve → Raydium)
- 🪙 **Web (Phantom):** https://app.agents-coin.com/pump
- 💬 **Telegram bot:** https://t.me/AgentsPumpBot — Buy/Sell auto-route to the bonding curve before graduation and to **Raydium** after.

MIT licensed.
