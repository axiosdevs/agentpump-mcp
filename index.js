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
  createAssociatedTokenAccountIdempotentInstruction, TOKEN_PROGRAM_ID, NATIVE_MINT,
} from "@solana/spl-token";
import { Raydium, TxVersion, CurveCalculator, CREATE_CPMM_POOL_PROGRAM } from "@raydium-io/raydium-sdk-v2";
import BN from "bn.js";
import bs58 from "bs58";
import { homedir } from "os";
import { join } from "path";
import { mkdirSync, readFileSync, writeFileSync, existsSync, chmodSync } from "fs";

const RPC = process.env.AGENTPUMP_RPC || "https://mainnet.helius-rpc.com/?api-key=397a9216-3198-4f6b-8304-0bf3f62cf5bd";
const PROGRAM = new PublicKey("4M93xdyduoYj4W7LaLRmXrk5PqyGD6SoxzX8CwdKe3VM");
const FEE = new PublicKey("2tGTwpzcLLgp6D33Sns4cMZuz1Zg6rBnzjt3taqTmZz6");
const RPCS = [RPC, "https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"].filter((v,i,a)=>a.indexOf(v)===i);
const rpcFetch = async (u, o) => { let err; for (const url of RPCS) { try { const r = await fetch(url, o); if (r.status === 429 || r.status >= 500) { err = new Error("rpc " + r.status); continue; } return r; } catch (e) { err = e; } } throw err; };
const conn = new Connection(RPC, { commitment: "confirmed", fetch: rpcFetch });
const [CONFIG] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM);
const V_SOL = 2500000000n, SUPPLY = 1000000000n * 1000000n;
const META = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const u64 = (n) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(n)); return b; };
const mstr = (s) => { const b = Buffer.from(s, "utf8"); const l = Buffer.alloc(4); l.writeUInt32LE(b.length); return Buffer.concat([l, b]); };
function metaIx(mint, auth, payer, name, sym) {
  const [md] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), META.toBuffer(), mint.toBuffer()], META);
  const data = Buffer.concat([Buffer.from([33]), mstr(name), mstr(sym), mstr(""), Buffer.from([0, 0]), Buffer.from([0]), Buffer.from([0]), Buffer.from([0]), Buffer.from([1]), Buffer.from([0])]);
  return new TransactionInstruction({ programId: META, keys: [
    { pubkey: md, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false }, { pubkey: auth, isSigner: true, isWritable: false },
    { pubkey: payer, isSigner: true, isWritable: true }, { pubkey: auth, isSigner: false, isWritable: false }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data });
}
async function metaOf(mint) { // read on-chain name/symbol from the Metaplex metadata account
  try {
    const [md] = PublicKey.findProgramAddressSync([Buffer.from("metadata"), META.toBuffer(), mint.toBuffer()], META);
    const ma = await conn.getAccountInfo(md); if (!ma) return {};
    const nlen = ma.data.readUInt32LE(65); const name = ma.data.slice(69, 69 + nlen).toString("utf8").replace(/\0/g, "").trim();
    const so = 69 + nlen; const slen = ma.data.readUInt32LE(so); const symbol = ma.data.slice(so + 4, so + 4 + slen).toString("utf8").replace(/\0/g, "").trim();
    return { name, symbol };
  } catch { return {}; }
}
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
// retry once on transient RPC/simulation flaps (stale blockhash, rate-limit, node hiccup) — the tx didn't land, so it's safe
async function retryTransient(fn) {
  try { return await fn(); }
  catch (e) { const m = ((e && e.message) || "") + "";
    if (/custom program error/i.test(m)) throw e; // deterministic on-chain rejection — a retry can't fix it
    if (/simulat|blockhash|not found|expired|timed out|timeout|429|too many|fetch failed|ECONN|socket|rate limit/i.test(m)) { await new Promise((r) => setTimeout(r, 1000)); return await fn(); }
    throw e; }
}
const send = (tx, signers) => retryTransient(() => sendAndConfirmTransaction(conn, tx, signers));

// --- Raydium CPMM helpers (trade graduated/listed tokens; 1% fee to treasury) ---
let _ray;
async function ray(kp) { if (!_ray) _ray = await Raydium.load({ connection: conn, owner: kp, cluster: "mainnet", disableLoadToken: true }); return _ray; }
async function findCpmmPool(raydium, mint) {
  const data = await raydium.api.fetchPoolByMints({ mint1: mint.toBase58(), mint2: NATIVE_MINT.toBase58() });
  const pools = (data?.data || []).filter((p) => p.programId === CREATE_CPMM_POOL_PROGRAM.toBase58());
  if (!pools.length) throw new Error("No Raydium pool found for this token yet — it may not have graduated/listed, or the pool was just created (indexing can take a few minutes).");
  pools.sort((a, b) => (b.tvl || 0) - (a.tvl || 0));
  return pools[0].id;
}
function estimate(inAmt, inRes, outRes, ci) {
  return CurveCalculator.swapBaseInput(inAmt, inRes, outRes, ci.tradeFeeRate, ci.creatorFeeRate, ci.protocolFeeRate, ci.fundFeeRate, false);
}

const s = new McpServer({ name: "agentpump", version: "1.1.6" });

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
  const kp = loadKp(); const mint = await retryTransient(() => createMint(conn, kp, kp.publicKey, null, 6)); // returns a PublicKey
  await send(new Transaction().add(metaIx(mint, kp.publicKey, kp.publicKey, name, symbol)), [kp]); // on-chain name/symbol so it shows on the launchpad
  const curve = curveOf(mint), cAta = ataOf(mint, curve);
  await send(new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, cAta, curve, mint)), [kp]);
  await retryTransient(() => mintTo(conn, kp, mint, cAta, kp, SUPPLY));
  const ix = new TransactionInstruction({ programId: PROGRAM, data: Buffer.concat([Buffer.from([1]), u64(V_SOL), u64(SUPPLY)]), keys: [
    { pubkey: CONFIG, isSigner: false, isWritable: true }, { pubkey: curve, isSigner: false, isWritable: true }, { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: cAta, isSigner: false, isWritable: true }, { pubkey: kp.publicKey, isSigner: true, isWritable: true }, { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ] });
  await send(new Transaction().add(ix), [kp]);
  return ok(`Launched ${symbol}. Token: ${mint.toBase58()}\nTradeable on the curve; graduates to Raydium at 10 SOL.`);
});
s.tool("sol_list_tokens", "Discover tokens currently trading on the AgentPump bonding curve (not yet graduated). Pass 'query' to filter by name/symbol. Returns each token's mint, name, market cap and % progress to graduation — then buy one with sol_buy.", { query: z.string().optional(), limit: z.number().optional() }, { title: "Find tokens", readOnlyHint: true, openWorldHint: true }, async ({ query, limit }) => {
  const accs = await retryTransient(() => conn.getProgramAccounts(PROGRAM, { filters: [{ dataSize: 130 }] }));
  const rows = [];
  for (const a of accs) { const d = a.account.data; if (d[128] !== 0) continue; // still on the curve (not graduated)
    const vsol = Number(d.readBigUInt64LE(96)), vtok = Number(d.readBigUInt64LE(104)), rsol = Number(d.readBigUInt64LE(112));
    rows.push({ mint: new PublicKey(d.slice(0, 32)), rsol, mcapSol: (vtok ? vsol / vtok : 0) * Number(SUPPLY) / LAMPORTS_PER_SOL, progress: Math.min(100, rsol / (10 * LAMPORTS_PER_SOL) * 100) });
  }
  rows.sort((x, y) => y.rsol - x.rsol);
  const pool = rows.slice(0, 40); // bound the metadata lookups
  for (const r of pool) { const m = await metaOf(r.mint); r.name = m.name || ""; r.symbol = m.symbol || ""; }
  let res = pool;
  if (query) { const q = query.toLowerCase(); res = pool.filter((r) => r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q) || r.mint.toBase58().includes(query)); }
  res = res.slice(0, Math.min(limit || 20, 40));
  if (!res.length) return ok(query ? `No live curve tokens match "${query}".` : "No active tokens on the curve right now.");
  const lines = res.map((r, i) => `${i + 1}. ${r.name || "(unnamed)"}${r.symbol ? " ($" + r.symbol + ")" : ""}\n   mint: ${r.mint.toBase58()}\n   mcap ~${r.mcapSol.toFixed(2)} SOL · ${r.progress.toFixed(1)}% to graduation`);
  return ok(`Tokens on the AgentPump curve (top by SOL raised):\n\n${lines.join("\n")}\n\nBuy one with sol_buy(mint, sol).`);
});
s.tool("sol_token_info", "Get live info for a token by mint: whether it's on the bonding curve or graduated, plus price, market cap and % progress to graduation.", { mint: z.string() }, { title: "Token info", readOnlyHint: true, openWorldHint: true }, async ({ mint: ms }) => {
  const mint = new PublicKey(ms); const ai = await conn.getAccountInfo(curveOf(mint)); const m = await metaOf(mint);
  const label = `${m.name || "(unnamed)"}${m.symbol ? " ($" + m.symbol + ")" : ""}\nmint: ${ms}`;
  if (!ai) return ok(`${label}\nNot an AgentPump curve token. If it's a normal/graduated SPL token, trade it with sol_raydium_buy / sol_raydium_sell.`);
  if (ai.data[128] !== 0) return ok(`${label}\nStatus: GRADUATED — trades on Raydium. Use sol_raydium_buy / sol_raydium_sell.`);
  const vsol = Number(ai.data.readBigUInt64LE(96)), vtok = Number(ai.data.readBigUInt64LE(104)), rsol = Number(ai.data.readBigUInt64LE(112));
  const mcap = (vtok ? vsol / vtok : 0) * Number(SUPPLY) / LAMPORTS_PER_SOL, progress = Math.min(100, rsol / (10 * LAMPORTS_PER_SOL) * 100);
  return ok(`${label}\nStatus: on bonding curve\nmcap ~${mcap.toFixed(2)} SOL · ${progress.toFixed(1)}% to graduation (${(rsol / LAMPORTS_PER_SOL).toFixed(3)}/10 SOL raised)\nBuy with sol_buy(mint, sol), sell with sol_sell(mint, percent).`);
});
s.tool("sol_buy", "Buy ANY token on its AgentPump bonding curve by mint — yours or one you found via sol_list_tokens (pre-graduation). For graduated tokens use sol_raydium_buy.", { mint: z.string(), sol: z.number() }, { title: "Buy (curve)", readOnlyHint: false, openWorldHint: true }, async ({ mint: ms, sol: amt }) => {
  const kp = loadKp(); const mint = new PublicKey(ms); const curve = curveOf(mint), cAta = ataOf(mint, curve), uAta = ataOf(mint, kp.publicKey);
  const tx = new Transaction().add(createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, uAta, kp.publicKey, mint))
    .add(new TransactionInstruction({ programId: PROGRAM, keys: tradeKeys(mint, curve, cAta, uAta, kp.publicKey), data: Buffer.concat([Buffer.from([2]), u64(Math.round(amt * LAMPORTS_PER_SOL)), u64(0)]) }));
  const sig = await send(tx, [kp]); return ok("Bought. " + sig);
});
s.tool("sol_sell", "Sell a percentage of a token holding back to the bonding curve (pre-graduation). For graduated tokens use sol_raydium_sell.", { mint: z.string(), percent: z.number() }, { title: "Sell (curve)", readOnlyHint: false, openWorldHint: true }, async ({ mint: ms, percent }) => {
  const kp = loadKp(); const mint = new PublicKey(ms); const curve = curveOf(mint), cAta = ataOf(mint, curve), uAta = ataOf(mint, kp.publicKey);
  const acc = await getAccount(conn, uAta); const amt = (acc.amount * BigInt(Math.round(percent))) / 100n;
  if (amt <= 0n) throw new Error("nothing to sell");
  const ix = new TransactionInstruction({ programId: PROGRAM, keys: tradeKeys(mint, curve, cAta, uAta, kp.publicKey), data: Buffer.concat([Buffer.from([3]), u64(amt), u64(0)]) });
  const sig = await send(new Transaction().add(ix), [kp]); return ok("Sold. " + sig);
});
s.tool("sol_raydium_buy", "Buy any graduated/listed token on Raydium (after it leaves the bonding curve). Charges a 1% fee.", { mint: z.string(), sol: z.number() }, { title: "Buy (Raydium)", readOnlyHint: false, openWorldHint: true }, async ({ mint: ms, sol: amt }) => {
  const kp = loadKp(); const mint = new PublicKey(ms);
  const lamports = BigInt(Math.round(amt * LAMPORTS_PER_SOL));
  const fee = lamports / 100n, swapIn = lamports - fee;
  const uAta = ataOf(mint, kp.publicKey);
  const raydium = await ray(kp);
  const { poolInfo, poolKeys, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(await findCpmmPool(raydium, mint)); // throws before any fee is charged
  await sendAndConfirmTransaction(conn, new Transaction()
    .add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: FEE, lamports: Number(fee) }))
    .add(createAssociatedTokenAccountIdempotentInstruction(kp.publicKey, uAta, kp.publicKey, mint)), [kp]);
  const baseIn = NATIVE_MINT.toBase58() === poolInfo.mintA.address;
  const inA = new BN(swapIn.toString());
  const sr = estimate(inA, baseIn ? rpcData.baseReserve : rpcData.quoteReserve, baseIn ? rpcData.quoteReserve : rpcData.baseReserve, rpcData.configInfo);
  const { execute } = await raydium.cpmm.swap({ poolInfo, poolKeys, inputAmount: inA, swapResult: sr, slippage: 0.1, baseIn, txVersion: TxVersion.V0 });
  const r = await execute({ sendAndConfirm: true });
  return ok(`Bought on Raydium. tx ${r.txId}\n1% fee (${(Number(fee) / LAMPORTS_PER_SOL).toFixed(5)} SOL) sent to treasury.`);
});
s.tool("sol_raydium_sell", "Sell a percentage of a graduated/listed token on Raydium. Charges a 1% fee on the SOL proceeds.", { mint: z.string(), percent: z.number() }, { title: "Sell (Raydium)", readOnlyHint: false, openWorldHint: true }, async ({ mint: ms, percent }) => {
  const kp = loadKp(); const mint = new PublicKey(ms);
  const uAta = ataOf(mint, kp.publicKey);
  const acc = await getAccount(conn, uAta); const amt = (acc.amount * BigInt(Math.round(percent))) / 100n;
  if (amt <= 0n) throw new Error("nothing to sell");
  const raydium = await ray(kp);
  const { poolInfo, poolKeys, rpcData } = await raydium.cpmm.getPoolInfoFromRpc(await findCpmmPool(raydium, mint));
  const baseIn = mint.toBase58() === poolInfo.mintA.address;
  const inA = new BN(amt.toString());
  const sr = estimate(inA, baseIn ? rpcData.baseReserve : rpcData.quoteReserve, baseIn ? rpcData.quoteReserve : rpcData.baseReserve, rpcData.configInfo);
  const before = await conn.getBalance(kp.publicKey);
  const { execute } = await raydium.cpmm.swap({ poolInfo, poolKeys, inputAmount: inA, swapResult: sr, slippage: 0.1, baseIn, txVersion: TxVersion.V0 });
  const r = await execute({ sendAndConfirm: true });
  const gained = (await conn.getBalance(kp.publicKey)) - before;
  let feePaid = 0;
  if (gained > 0) { feePaid = Math.floor(gained * 0.01); if (feePaid > 0) await sendAndConfirmTransaction(conn, new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: FEE, lamports: feePaid })), [kp]); }
  return ok(`Sold on Raydium. tx ${r.txId}\n1% fee (${(feePaid / LAMPORTS_PER_SOL).toFixed(5)} SOL) sent to treasury.`);
});

s.tool("sol_withdraw", "Send SOL out of the agent wallet to any address. Omit 'sol' to send the whole balance (minus the network fee).", { to: z.string(), sol: z.number().optional() }, { title: "Withdraw SOL", readOnlyHint: false, openWorldHint: true }, async ({ to, sol }) => {
  const kp = loadKp(); const dest = new PublicKey(to);
  const bal = await conn.getBalance(kp.publicKey); const FEE_L = 5000;
  let lamports = (sol == null) ? bal - FEE_L : Math.round(sol * LAMPORTS_PER_SOL);
  if (lamports > bal - FEE_L) lamports = bal - FEE_L;
  if (lamports <= 0) throw new Error("balance too low to withdraw (need to cover the ~0.000005 SOL network fee)");
  const sig = await send(new Transaction().add(SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: dest, lamports })), [kp]);
  return ok(`Sent ${(lamports / LAMPORTS_PER_SOL).toFixed(6)} SOL to ${to}\n${sig}`);
});
s.tool("sol_export_key", "Reveal the agent wallet's private key (base58) so it can be imported into Phantom/Solflare. Anyone with this key controls the funds — only show it to the wallet owner.", {}, { title: "Export private key", readOnlyHint: true }, async () => {
  const kp = loadKp();
  return ok("Private key (import into Phantom → 'Import Private Key'):\n" + bs58.encode(kp.secretKey) + "\n\n⚠️ Anyone with this key controls the wallet. Keep it secret.");
});

await s.connect(new StdioServerTransport());
