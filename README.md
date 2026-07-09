# AgentPump — give your AI agent a Solana wallet 🤖

**Open-source Claude Desktop extension / MCP server that lets an AI agent launch and trade tokens on Solana — autonomously, from a prompt.**

Your agent gets its own wallet: the private key is generated **locally** and never leaves your machine — it's never sent to the model or any server, only signatures go on-chain. You fund it with a little SOL, then it can create memecoins, buy, and sell on its own on [AgentPump](https://app.agents-coin.com/agentpump) — a fair bonding-curve launchpad on **Solana mainnet** that graduates coins to Raydium.

> This repository is the **client extension** you install (open source, MIT). It's the code that runs on *your* machine — read every line. Start small; real money on mainnet.

🌐 [Website](https://app.agents-coin.com/agentpump) · 📦 [npm: agentpump-mcp](https://www.npmjs.com/package/agentpump-mcp) · 🪙 [Trade on the web](https://app.agents-coin.com/pump) · 💬 [Telegram bot](https://t.me/AgentsPumpBot)

---

## Install

### Claude Desktop — one click
Download **[`agentpump.mcpb`](https://github.com/axiosdevs/agentpump-mcp/releases/latest/download/agentpump.mcpb)** → open it with Claude Desktop → *Settings → Extensions → Install*. A mainnet RPC is built in — nothing to configure.

### Any MCP client (Cursor, Claude Code, …) via npx
```json
{
  "mcpServers": {
    "agentpump": { "command": "npx", "args": ["-y", "agentpump-mcp@latest"] }
  }
}
```
Also in the official MCP Registry as `io.github.axiosdevs/agentpump-mcp`.

## Then talk to your agent
```
"create a Solana wallet"
"show my address"          ← fund it with a little SOL
"launch a token called Doge AI (DOGEAI)"
"buy 0.1 SOL of <mint>"
"sell 50% of <mint>"
"buy 0.2 SOL of <mint> on Raydium"   ← after it graduates
```

## Tools
| Tool | Does |
|---|---|
| `sol_create_wallet` / `sol_address` / `sol_balance` | Local agent wallet (`~/.agentpump/wallet.json`) |
| `sol_launch` | Launch a token on the bonding curve |
| `sol_buy` / `sol_sell` | Trade on the curve (pre-graduation) |
| `sol_raydium_buy` / `sol_raydium_sell` | Trade graduated tokens on Raydium |

Everything the extension does is in [`index.js`](index.js) — this is exactly what `npx agentpump-mcp` runs. No build step, no hidden network calls.

## What AgentPump is
A pump.fun-style launchpad on **Solana mainnet** — usable by AI agents (this extension), people (Telegram bot / web), alike:

1. **Mint** — launching is free (~0.02 SOL network rent). 1B supply, all on the curve. No presale, no team allocation.
2. **Pump** — constant-product bonding curve; ~80% of supply sells on it. 1% fee per trade, shared with the token creator (+ referrer).
3. **Graduate** — at **10 SOL** the curve closes, a **Raydium** pool is created and the **LP is burned** — liquidity locked forever. Then it trades everywhere (Raydium, Jupiter, DexScreener…).

On-chain program: [`4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM`](https://solscan.io/account/4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM) (verifiable on Solscan).

MIT licensed.
