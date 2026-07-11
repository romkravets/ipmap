import http from "http";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import { healthRouter } from "./routes/health.js";
import { createBroadcaster, broadcast } from "./ws/broadcaster.js";
import { bootstrapPrices } from "./connectors/BinanceConnector.js";
import { bootstrapFromKraken, startKrakenConnector } from "./connectors/KrakenConnector.js";
import {
  getPriceSnapshot,
  getCachedMeta,
  onPriceUpdate,
} from "./services/PriceService.js";
import { startCoinGeckoPoller, startCoinGeckoPricePoller } from "./connectors/CoinGeckoConnector.js";
import { startWhaleConnector } from "./connectors/WhaleConnector.js";
import { startLiquidationsConnector } from "./connectors/LiquidationsConnector.js";
import { startFundingConnector } from "./connectors/FundingConnector.js";
import { startEthGasConnector } from "./connectors/EthGasConnector.js";
import { startWhaleService } from "./services/WhaleService.js";
import { startCommodityConnector, getCachedCommodities } from "./connectors/CommodityConnector.js";

const PORT = Number(process.env.PORT ?? 4000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";

// ── Express ───────────────────────────────────────────────────────────────────
const app = express();

app.use(helmet());
app.use(express.json());

// CORS — only allow our web client
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || origin === CLIENT_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", CLIENT_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Rate limit — 100 requests per minute per IP
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.use("/api", healthRouter);

// ── HTTP + WS server ──────────────────────────────────────────────────────────
const server = http.createServer(app);

const isDev = process.env.NODE_ENV !== "production";

const ALLOWED_ORIGINS = new Set([
  CLIENT_ORIGIN,
  "https://sessionmap-web.onrender.com",
]);

const wss = new WebSocketServer({
  server,
  verifyClient: ({ origin }, cb) => {
    // In dev accept any localhost origin (port varies across restarts)
    const allowed = !origin
      || (isDev && /^https?:\/\/localhost(:\d+)?$/.test(origin))
      || ALLOWED_ORIGINS.has(origin);
    cb(allowed, 403, "Forbidden origin");
  },
});

createBroadcaster(wss);

// Send snapshot to new clients immediately on connection
wss.on("connection", (ws) => {
  // Brief delay so createBroadcaster registers listeners first
  setImmediate(() => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "prices", data: getPriceSnapshot() }));
      ws.send(JSON.stringify({ type: "meta", data: getCachedMeta() }));
      ws.send(JSON.stringify({ type: "commodities", data: getCachedCommodities() }));
    }
  });
});

// ── Data connectors ───────────────────────────────────────────────────────────
onPriceUpdate(() => {
  broadcast({ type: "prices", data: getPriceSnapshot() });
});

// Bootstrap: try Kraken (EU-legal), fall back to Binance REST, then CoinGecko
bootstrapFromKraken().then((ok) => {
  if (!ok) return bootstrapPrices();
}).then(() => {
  startKrakenConnector();
});

startCoinGeckoPoller((meta) => {
  broadcast({ type: "meta", data: meta });
});

// Price fallback poller — runs in parallel with Binance WS
// Keeps prices fresh if Binance is geo-blocked (e.g. EU/Frankfurt)
startCoinGeckoPricePoller();

startWhaleConnector();
startWhaleService();
startLiquidationsConnector();
startFundingConnector();
startEthGasConnector();
startCommodityConnector();

// ── Start listening ───────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[Server] Listening on http://localhost:${PORT}`);
  console.log(`[Server] WS on ws://localhost:${PORT}`);
  console.log(`[Server] Accepting connections from: ${CLIENT_ORIGIN}`);
});
