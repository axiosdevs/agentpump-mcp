#!/usr/bin/env node
// AgentPump MCP — let an AI agent launch & trade tokens on the AgentPump launchpad (Solana mainnet).
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction,
  TransactionInstruction, sendAndConfirmTransaction, LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint, getAssociatedTokenAddressSync, mintTo, getAccount,
  createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "fs";

const RPC = process.env.AGENTPUMP_RPC || "https://api.mainnet-beta.solana.com";
const PROGRAM = new PublicKey("4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM");
const FEE = new PublicKey("2tGTwpzcLLgp6D33Sns4cMZuz1Zg6rBnzjt3taqTmZz6");
const conn = new Connection(RPC, "confirmed");
const [CONFIG] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM);
const V_SOL = 30n * 1000000000n, SUPPLY = 1000000000n * 1000000n;
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const WDIR = join(homedir(), ".agentpump"), WFILE = join(WDIR, "wallet.json");
const curveOf = (m) => PublicKey.findProgramAddressSync([Buffer.from("curve"), m.toBuffer()], PROGRAM)[0];
const ataOf = (m, o) => getAssociatedTokenAddressSync(m, o, true);

function loadKp() { if (!existsSync(WFILE)) throw new Error("No wallet yet. Call sol_create_wallet first."); return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(WFILE)))); }
function tradeKeys(mint, curve, cAta, uAta, user) {
  return [
    { pubkey: CONFIG, isSigner: false, isWritable: false }, { pubkey: curve, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: cAta, isSigner: false, isWritable: true }, { pubkey: uAta, isSigner: false, isWritable: true }, { pubkey: curve, isSigner: false, isWritable: true },
    { pubkey: FEE, isSigner: false, isWritable: true }, { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];
}
const ok = (t) => ({ content: [{ type: "text", text: t }] });

const s = new McpServer({ name: "agentpump", version: "1.0.0" });

s.tool("sol_create_wallet", "Create the agent's Solana wallet (saved locally, hidden). Returns the address to fund.", {}, { title: "Create wallet", readOnlyHint: false }, async () => {
  if (existsSync(WFILE)) return ok("Wallet already exists: " + loadKp().publicKey.toBase58());
  mkdirSync(WDIR, { recursive: true }); const kp = Keypair.generate();
  writeFileSync(WFILE, JSON.stringify(Array.from(kp.secretKey))); chmodSync(WFILE, 0o600);
  return ok("Wallet created: " + kp.publicKey.toBase58() + "\nFund it with SOL to start (no faucet on mainnet).");
});
s.tool("sol_address", "Show the agent's Solana wallet address to deposit SOL into.", {}, { title: "Address", readOnlyHint: true }, async () => ok(loadKp().publicKey.toBase58()));
s.tool("sol_balance", "Check the wallet's SOL balance.", {}, { title: "Balance", readOnlyHint: true }, async () => {
  const kp = loadKp(); const b = await conn.getBalance(kp.publicKey); return ok((b / LAMPORTS_PER_SOL).toFixed(4) + " SOL\n" + kp.publicKey.toBase58());
});
s.tool("sol_launch", "Launch a new token on AgentPump (bonding curve). Costs ~0.02 SOL in rent.", { name: z.string(), symbol: z.string() }, { title: "Launch token", readOnlyHint: false, openWorldHint: true }, async ({ name, symbol }) => {
  const kp = loadKp(); const mint = await createMint(conn, kp, kp.publicKey, null, 6);
  const curve = curveOf(mint.publicKey), cAta = ataOf(mint.publicKey, curve);
  await sendAndConfirmTransaction(conn, new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, cAta, curve, mint.publicKey)), [kp]);
  await mintTo(conn, kp, mint, cAta, kp, SUPPLY);
  const ix = new TransactionInstruction({ programId: PROGRAM, data: Buffer.concat([Buffer.from([1]), u64(V_SOL), u64(SUPPLY)]), keys: [
    { pubkey: CONFIG, isSigner: false, isWritable: true }, { pubkey: curve, isSigner: false, isWritable: true }, { pubkey: mint.publicKey, isSigner: false, isWritable: false },
    { pubkey: cAta, isSigner: false, isWritable: true }, { pubkey: kp.publicKey, isSigner: true, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ] });
  await sendAndConfirmTransaction(conn, new Transaction().add(ix), [kp]);
  return ok(`Launched ${symbol}. Token: ${mint.publicKey.toBase58()}\nTradeable on the curve; graduates to Raydium at 10 SOL.`);
});
s.tool("sol_buy", "Buy a token on its bonding curve.", { mint: z.string(), sol: z.number() }, { title: "Buy", readOnlyHint: false, openWorldHint: true }, async ({ mint: ms, sol: amt }) => {
  const kp = loadKp(); const mint = new PublicKey(ms); const curve = curveOf(mint), cAta = ataOf(mint, curve), uAta = ataOf(mint, kp.publicKey);
  const tx = new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, uAta, kp.publicKey, mint))
    .add(new TransactionInstruction({ programId: PROGRAM, keys: tradeKeys(mint, curve, cAta, uAta, kp.publicKey), data: Buffer.concat([Buffer.from([2]), u64(Math.round(amt * LAMPORTS_PER_SOL)), u64(0)]) }));
  const sig = await sendAndConfirmTransaction(conn, tx, [kp]); return ok("Bought. " + sig);
});
s.tool("sol_sell", "Sell a percentage of a token holding back to the curve.", { mint: z.string(), percent: z.number() }, { title: "Sell", readOnlyHint: false, openWorldHint: true }, async ({ mint: ms, percent }) => {
  const kp = loadKp(); const mint = new PublicKey(ms); const curve = curveOf(mint), cAta = ataOf(mint, curve), uAta = ataOf(mint, kp.publicKey);
  const acc = await getAccount(conn, uAta); const amt = (acc.amount * BigInt(Math.round(percent))) / 100n;
  if (amt <= 0n) throw new Error("nothing to sell");
  const ix = new TransactionInstruction({ programId: PROGRAM, keys: tradeKeys(mint, curve, cAta, uAta, kp.publicKey), data: Buffer.concat([Buffer.from([3]), u64(amt), u64(0)]) });
  const sig = await sendAndConfirmTransaction(conn, new Transaction().add(ix), [kp]); return ok("Sold. " + sig);
});

await s.connect(new StdioServerTransport());
