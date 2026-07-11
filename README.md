# AgentPump — give your AI agent a Solana wallet 🤖

**Open-source MCP server that lets an AI agent launch and trade tokens on Solana — autonomously, from plain-language chat.**

Add one MCP server to **Claude Code, Cursor, or any MCP client**, then just tell your agent to launch and trade tokens on [AgentPump](https://app.agents-coin.com/agentpump), a fair bonding-curve launchpad on **Solana mainnet**. The private key is generated **locally** and never leaves your machine — it's never sent to the model or any server, only signatures hit the chain.

> Live on Solana mainnet. Real money — start small.

🌐 [Website](https://app.agents-coin.com/agents) · 📦 [npm: agentpump-mcp](https://www.npmjs.com/package/agentpump-mcp) · 🪙 [Trade on the web](https://app.agents-coin.com/pump) · 💬 [Telegram bot](https://t.me/AgentsPumpBot)

---

## Install

### Claude Code
```
claude mcp add agentpump -- npx -y agentpump-mcp
```

### Any MCP client (Cursor, Claude Code, …)
Add to your MCP config:
```json
{
  "mcpServers": {
    "agentpump": { "command": "npx", "args": ["-y", "agentpump-mcp"] }
  }
}
```
Also in the official MCP Registry as `io.github.axiosdevs/agentpump-mcp`. A mainnet RPC is built in — nothing to configure.

## Then just chat
Talk to your agent in plain language — it calls the tools:
```
"create a Solana wallet and show me the address"     ← then fund it with a little SOL
"launch a token called Doge AI (DOGEAI), then buy 0.05 SOL of it"
"find tokens on the launchpad and buy 0.05 SOL of the top one"
"sell 50% of <mint>"
"buy 0.2 SOL of <mint> on Raydium"     ← after it graduates
"withdraw all my SOL to <address>"
```

## Tools
| Tool | Does |
|---|---|
| `sol_create_wallet` / `sol_address` / `sol_balance` | Local agent wallet (`~/.agentpump/wallet.json`) |
| `sol_list_tokens` / `sol_token_info` | **Discover & inspect** tokens on the launchpad — find by name, see market cap & % progress to graduation |
| `sol_launch` | Launch a token on the bonding curve |
| `sol_buy` / `sol_sell` | Trade **any** curve token by mint — one you launched or one you found (pre-graduation) |
| `sol_raydium_buy` / `sol_raydium_sell` | Trade graduated tokens on Raydium |
| `sol_withdraw` / `sol_export_key` | Move SOL out to any address / export the wallet key to Phantom |

The whole client is one [`index.js`](index.js) — exactly what `npx agentpump-mcp` runs. No build step, no hidden network calls. Read every line before funding it.

## How the launchpad works
1. **Mint** — launching is free (~0.008 SOL network rent, none to the protocol). 1B supply, all on the curve. No presale, no team allocation.
2. **Pump** — constant-product bonding curve; ~80% of supply sells on it. **1% fee per trade**, shared with the token creator (+ referrer).
3. **Graduate** — at **10 SOL** the curve closes, a **Raydium** pool is created and the **LP is burned** — liquidity locked forever. Then it trades everywhere (Raydium, Jupiter, DexScreener…).

On-chain program: [`4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM`](https://solscan.io/account/4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM) (verifiable on Solscan).

## Also for people (no MCP needed)
- 🪙 **Web (Phantom):** https://app.agents-coin.com/pump
- 💬 **Telegram bot:** https://t.me/AgentsPumpBot

MIT licensed.
