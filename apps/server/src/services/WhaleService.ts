import type { WhaleEvent } from "@sessionmap/types";
import { broadcast } from "../ws/broadcaster.js";
import { getLastRealWhaleTs } from "../connectors/WhaleConnector.js";

const EXCHANGES = [
  "Binance", "OKX", "Bybit", "Coinbase", "HTX",
  "KuCoin", "Deribit", "Kraken", "Bitfinex", "Upbit",
  "Gate.io", "MEXC", "BitMEX", "Bithumb", "Gemini", "Bitstamp",
];
const EVENT_TYPES: WhaleEvent["type"][] = ["transfer", "deposit", "withdraw", "dex"];

function generateWhale(): WhaleEvent {
  const i1 = Math.floor(Math.random() * EXCHANGES.length);
  let i2 = Math.floor(Math.random() * (EXCHANGES.length - 1));
  if (i2 >= i1) i2++;
  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)],
    amount: Math.floor(Math.random() * 4500 + 200),
    from: EXCHANGES[i1],
    to: EXCHANGES[i2],
    ts: Date.now(),
    simulated: true,
  };
}

const FALLBACK_SILENCE_MS = 15_000;

export function startWhaleService() {
  function maybeFire() {
    const silentMs = Date.now() - getLastRealWhaleTs();
    if (silentMs >= FALLBACK_SILENCE_MS) {
      broadcast({ type: "whale", data: generateWhale() });
    }
    setTimeout(maybeFire, (4 + Math.random() * 6) * 1000);
  }
  setTimeout(maybeFire, 5000);
}
