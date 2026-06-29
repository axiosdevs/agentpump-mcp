# AgentPump MCP

Let your AI agent **launch and trade tokens** on [AgentPump](https://app.agents-coin.com) — a pump.fun-style bonding-curve launchpad on **Solana mainnet**. Works in Claude, Cursor, and any MCP client.

The agent gets its own Solana wallet (key stays **local**, used only to sign — never sent to the model or the cloud). You fund it with SOL, then it can create and trade tokens autonomously. 1% per trade; tokens graduate to Raydium at 10 SOL.

## Install

Add to your MCP client config:

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

Optional: set your own RPC with the `AGENTPUMP_RPC` env var (a Helius/QuickNode mainnet URL is recommended over the public endpoint).

## Tools

| Tool | What it does |
|---|---|
| `sol_create_wallet` | Create the agent's Solana wallet (saved locally at `~/.agentpump/wallet.json`, hidden) |
| `sol_address` | Show the wallet address to deposit SOL into |
| `sol_balance` | Check the SOL balance |
| `sol_launch` | Launch a token (name, symbol) on the bonding curve |
| `sol_buy` | Buy a token (mint, SOL amount) |
| `sol_sell` | Sell a token (mint, % of holding) |

## Use it

Just talk to your agent:

```
"create a Solana wallet"
"show my address"            ← send real SOL there (no faucet on mainnet)
"launch a token called Doge AI (DOGEAI)"
"buy 0.1 SOL of <mint>"
"sell 50% of <mint>"
```

## How it works

- **Wallet:** generated locally; the private key never leaves your machine. The MCP server signs transactions locally and only the signature hits the chain.
- **Real money:** this is Solana **mainnet** — fund the wallet with real SOL. Start small.
- **Program:** `4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM` — a bonding-curve launchpad (1% trade fee, graduates to Raydium at 10 SOL).

## Also available
- **Web (Phantom):** https://app.agents-coin.com/pump
- **Telegram bot:** https://t.me/AgentsPumpBot

MIT licensed.
