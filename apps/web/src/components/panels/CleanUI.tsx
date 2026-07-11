"use client";

import { SESSION_COLORS_CSS, SESSION_LABELS } from "@/lib/constants";
import { formatCountdown } from "@/lib/session-logic";
import type {
  CommodityData,
  EthGas,
  GlobeMode,
  MarketMeta,
  PriceSnapshot,
  SessionInfo,
  WhaleEvent,
} from "@sessionmap/types";
import { memo } from "react";
import { AltcoinSeasonBadge } from "./AltcoinSeasonBadge";
import { GlobeModeBar } from "./GlobeModeBar";
import { SeasonWidget } from "./SeasonWidget";
import { SessionVolumeBars } from "./SessionVolumeBars";
import { WhaleTicker } from "./WhaleTicker";

interface CleanUIProps {
  session: SessionInfo;
  prices: PriceSnapshot;
  onToggleTerminal: () => void;
  globeMode: GlobeMode;
  onGlobeModeChange: (mode: GlobeMode) => void;
  sunInfo: { lat: number; lng: number } | null;
  whaleEvents: WhaleEvent[];
  wsStatus: "connecting" | "connected" | "disconnected";
  ethGas?: EthGas | null;
  marketMeta?: MarketMeta | null;
  onToggleAlerts?: () => void;
  alertCount?: number;
  /** Pearson r for BTC vs QQQ 30-day log-returns. null = still loading */
  btcQqqCorr?: number | null;
  commodities?: CommodityData | null;
}

export const CleanUI = memo(function CleanUI({
  session,
  prices,
  onToggleTerminal,
  globeMode,
  onGlobeModeChange,
  sunInfo,
  whaleEvents,
  wsStatus,
  ethGas,
  marketMeta,
  onToggleAlerts,
  alertCount = 0,
  btcQqqCorr,
  commodities,
}: CleanUIProps) {
  const { active, nextEvent, volatility } = session;

  const topSymbols = ["BTC", "ETH", "SOL", "XRP"] as const;

  return (
    <div
      className="clean-ui-wrap"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        padding: "20px 28px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* ── Top bar ────────────────────────────────────── */}
      <div
        className="clean-ui-topbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
          <span
            style={{
              fontFamily: "var(--font-display, serif)",
              fontSize: "18px",
              letterSpacing: "0.02em",
              color: "var(--fg)",
              opacity: 0.9,
            }}
          >
            SessionMap
          </span>
          <span
            style={{
              fontSize: "10px",
              color: "var(--fg-muted)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            beta
          </span>
          {wsStatus === "disconnected" && (
            <span
              style={{
                fontSize: "9px",
                color: "var(--danger)",
                fontFamily: "var(--font-mono, monospace)",
                border: "1px solid var(--danger)",
                borderRadius: "3px",
                padding: "1px 6px",
              }}
            >
              STALE
            </span>
          )}
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <GlobeModeBar mode={globeMode} onChange={onGlobeModeChange} />
          {onToggleAlerts && (
            <button
              onClick={onToggleAlerts}
              style={{
                pointerEvents: "all",
                background: alertCount > 0 ? "rgba(251,146,60,0.15)" : "rgba(6,9,18,0.72)",
                border: `1px solid ${alertCount > 0 ? "rgba(251,146,60,0.6)" : "rgba(255,255,255,0.22)"}`,
                borderRadius: "6px",
                padding: "5px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                color: alertCount > 0 ? "rgba(251,146,60,0.95)" : "rgba(255,255,255,0.88)",
                fontSize: "11px",
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "0.08em",
                transition: "all 0.3s ease",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
              title="Price alerts"
            >
              🔔<span className="topbar-btn-text">{alertCount > 0 ? ` ${alertCount}` : ""}</span>
            </button>
          )}
          <button
            onClick={onToggleTerminal}
            style={{
              pointerEvents: "all",
              background: "rgba(6,9,18,0.72)",
              border: "1px solid rgba(255,255,255,0.22)",
              borderRadius: "6px",
              padding: "5px 12px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "7px",
              color: "rgba(255,255,255,0.88)",
              fontSize: "11px",
              fontFamily: "var(--font-mono, monospace)",
              letterSpacing: "0.08em",
              transition: "all 0.3s ease",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "rgba(125,211,252,0.8)",
                boxShadow: "0 0 4px rgba(125,211,252,0.6)",
                display: "inline-block",
              }}
            />
            <span className="topbar-btn-text">Terminal</span>
          </button>
        </div>
      </div>

      {/* ── Follow-sun strip ──────────────────────────── */}
      {globeMode === "follow" && sunInfo && (
        <div
          style={{
            alignSelf: "center",
            background: "rgba(255,200,50,0.07)",
            border: "1px solid rgba(255,200,50,0.15)",
            borderRadius: "8px",
            padding: "6px 16px",
            display: "flex",
            gap: "18px",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              color: "#FFD060",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            ☀ {sunInfo.lat > 0 ? "N" : "S"}
            {Math.abs(sunInfo.lat).toFixed(1)}°&nbsp;&nbsp;
            {sunInfo.lng > 0 ? "E" : "W"}
            {Math.abs(sunInfo.lng).toFixed(1)}°
          </span>
          <span style={{ fontSize: "11px", color: "var(--fg-muted)" }}>
            Solar noon meridian
          </span>
        </div>
      )}

      {/* ── Whale ticker ──────────────────────────────── */}
      <div className="clean-ui-whale-ticker">
        <WhaleTicker events={whaleEvents} />
      </div>

      {/* ── Bottom row ──────────────────────────────────  */}
      <div
        className="clean-ui-bottom"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
        }}
      >
        {/* Session status */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            maxWidth: "300px",
          }}
        >
          {active.length === 0 ? (
            <div
              style={{
                fontSize: "22px",
                fontWeight: 300,
                color: "var(--fg-muted)",
              }}
            >
              Markets quiet
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "4px" }}
            >
              {active.map((s) => (
                <div
                  key={s}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: SESSION_COLORS_CSS[s],
                      boxShadow: `0 0 8px ${SESSION_COLORS_CSS[s]}`,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: active.length > 1 ? "16px" : "22px",
                      fontWeight: 300,
                      color: "var(--fg)",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {SESSION_LABELS[s]} active
                  </span>
                  {active.length > 1 && (
                    <span
                      style={{
                        fontSize: "10px",
                        background: "var(--overlap)",
                        color: "#000",
                        padding: "1px 6px",
                        borderRadius: "3px",
                        fontFamily: "var(--font-mono, monospace)",
                        fontWeight: 600,
                      }}
                    >
                      OVERLAP
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          {nextEvent && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--fg-muted)",
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "0.01em",
                marginTop: "2px",
              }}
            >
              {SESSION_LABELS[nextEvent.session]}{" "}
              {nextEvent.type === "open" ? "opens" : "closes"} in{" "}
              <span style={{ color: "var(--fg)", fontWeight: 500 }}>
                {formatCountdown(nextEvent.hours)}
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginTop: "4px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "var(--fg-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                fontWeight: 500,
              }}
            >
              Volatility
            </span>
            <span
              style={{
                fontSize: "10px",
                fontFamily: "var(--font-mono, monospace)",
                color:
                  volatility === "high"
                    ? "var(--danger)"
                    : volatility === "medium"
                      ? "var(--accent-warm)"
                      : "var(--fg-muted)",
                fontWeight: 500,
              }}
            >
              {volatility.toUpperCase()}
            </span>
          </div>

          <a
            href="https://github.com/romkravets"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              pointerEvents: "auto",
              fontSize: "9px",
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--fg-muted)",
              opacity: 0.35,
              letterSpacing: "0.08em",
              textDecoration: "none",
              marginTop: "8px",
              transition: "opacity 0.2s",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.7")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLAnchorElement).style.opacity = "0.35")}
          >
            github.com/romkravets
          </a>
        </div>

        {/* Center column: volume bars, altcoin season, gas */}
        <div
          className="clean-ui-center"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            flex: 1,
            maxWidth: "220px",
            alignSelf: "flex-end",
          }}
        >
          <SessionVolumeBars compact />
          <AltcoinSeasonBadge prices={prices} compact />
          {ethGas && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-mono, monospace)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                ETH Gas
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--session-europe)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {ethGas.slow}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--fg-dim)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                ·
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--accent-warm)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {ethGas.standard}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--fg-dim)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                ·
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--danger)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {ethGas.fast}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--fg-dim)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                gwei
              </span>
            </div>
          )}
          {marketMeta && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-mono, monospace)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                BTC.dom
              </span>
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--accent)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: 500,
                }}
              >
                {(marketMeta.btcDominance ?? 0).toFixed(1)}%
              </span>
            </div>
          )}
          {btcQqqCorr != null && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <span
                style={{
                  fontSize: "9px",
                  color: "var(--fg-muted)",
                  fontFamily: "var(--font-mono, monospace)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                CORR(BTC,QQQ) 30d
              </span>
              <span
                style={{
                  fontSize: "10px",
                  fontFamily: "var(--font-mono, monospace)",
                  fontWeight: 500,
                  color:
                    btcQqqCorr >= 0.5
                      ? "var(--session-europe)"
                      : btcQqqCorr <= -0.5
                        ? "var(--danger)"
                        : "var(--fg-muted)",
                }}
              >
                {btcQqqCorr >= 0 ? "+" : ""}
                {btcQqqCorr.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Price ticker */}
        <div
          className="clean-ui-prices"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: "6px",
          }}
        >
          {topSymbols.map((sym) => {
            const entry = prices[sym];
            if (!entry) return null;
            const chg = entry.change24h;
            const isPos = chg >= 0;
            return (
              <div
                key={sym}
                className={sym === "SOL" || sym === "XRP" ? "clean-ui-price-extra" : ""}
                style={{ display: "flex", alignItems: "baseline", gap: "8px" }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--fg-muted)",
                    fontFamily: "var(--font-mono, monospace)",
                    letterSpacing: "0.08em",
                    fontWeight: 500,
                  }}
                >
                  {sym}
                </span>
                <span
                  style={{
                    fontSize: "14px",
                    fontFamily: "var(--font-mono, monospace)",
                    color: "var(--fg)",
                    fontWeight: 500,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {sym === "XRP"
                    ? `$${entry.price.toFixed(4)}`
                    : entry.price >= 1
                      ? `$${entry.price.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
                      : `$${entry.price.toFixed(4)}`}
                </span>
                <span
                  style={{
                    fontSize: "11px",
                    fontFamily: "var(--font-mono, monospace)",
                    color: isPos ? "var(--session-europe)" : "var(--danger)",
                    fontWeight: 500,
                  }}
                >
                  {isPos ? "+" : ""}
                  {chg.toFixed(2)}%
                </span>
              </div>
            );
          })}

          {/* Commodity Prices */}
          {commodities && (
            <div
              className="clean-ui-commodities"
              style={{
                borderTop: "1px solid rgba(255,255,255,0.06)",
                paddingTop: "8px",
                marginTop: "8px",
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--fg-dim)",
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  marginBottom: "6px",
                }}
              >
                COMMODITIES
              </div>
              {[
                { label: "GOLD", data: commodities.gold },
                { label: "OIL", data: commodities.oil },
                { label: "GAS", data: commodities.gas },
              ]
                .filter((c) => c.data)
                .map(({ label, data }) => (
                  <div
                    key={label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: "4px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--fg-muted)",
                        fontFamily: "monospace",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        fontFamily: "monospace",
                        color: data!.changePercent >= 0 ? "#34d399" : "#f87171",
                      }}
                    >
                      ${data!.price.toFixed(2)}
                      <span
                        style={{
                          fontSize: "8px",
                          marginLeft: "4px",
                          opacity: 0.8,
                        }}
                      >
                        {data!.changePercent >= 0 ? "+" : ""}
                        {data!.changePercent.toFixed(2)}%
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          )}

          {/* Earth Seasons */}
          <div className="clean-ui-season"><SeasonWidget /></div>
        </div>
      </div>
    </div>
  );
});
