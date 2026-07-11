"use client";

import { useState, useEffect, useRef, memo } from "react";
import { STOCK_MARKETS, isStockMarketOpen } from "@/lib/constants";
import type { StockMarket } from "@/lib/constants";

interface Position {
  x: number;
  y: number;
  visible: boolean;
}

/** Returns "Opens in Xh Ym" for a closed market, or "" if open / calculation fails */
function getOpensIn(m: StockMarket, now: Date): string {
  // Get current local decimal hour in the market's timezone
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "numeric",
    hour12: false,
    timeZone: m.tz,
  }).formatToParts(now);
  const h   = parseInt(parts.find((p) => p.type === "hour")?.value   ?? "0");
  const min = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const localH = h + min / 60;

  let diffH: number;
  if (localH < m.openLocal) {
    diffH = m.openLocal - localH;
  } else {
    // After close — next day open (add 24h wrap)
    diffH = (m.openLocal + 24) - localH;
  }

  const totalMins = Math.round(diffH * 60);
  const hours = Math.floor(totalMins / 60);
  const mins  = totalMins % 60;
  if (hours > 0 && mins > 0) return `Opens in ${hours}h ${mins}m`;
  if (hours > 0)             return `Opens in ${hours}h`;
  return `Opens in ${mins}m`;
}

export const StockMarketLabels = memo(function StockMarketLabels() {
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  // Track projected screen positions via globe's shared projector
  useEffect(() => {
    const update = () => {
      if (!window.globeProject) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }
      const next: Record<string, Position> = {};
      STOCK_MARKETS.forEach((m) => {
        next[m.id] = window.globeProject!(m.lat, m.lng);
      });
      setPositions(next);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // Refresh open/close state every 30 s — Intl handles DST automatically
  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      const next: Record<string, boolean> = {};
      STOCK_MARKETS.forEach((m) => {
        next[m.id] = isStockMarketOpen(m, now);
      });
      setOpenState(next);
    };
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {STOCK_MARKETS.map((market) => {
        const pos = positions[market.id];
        if (!pos?.visible) return null;
        const open = openState[market.id] ?? false;
        const isHov = hovered === market.id;
        const col = market.color;

        // Diamond sizes: larger when open
        const diamondSize = open ? 12 : 8;

        return (
          <div
            key={market.id}
            onMouseEnter={() => setHovered(market.id)}
            onMouseLeave={() => setHovered(null)}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "all",
              cursor: "default",
              zIndex: isHov ? 150 : 20,
            }}
          >
            {/* STOCK badge — always visible above diamond, clearly labels this as traditional exchange */}
            <div style={{
              position: "absolute",
              left: "50%",
              top: "-18px",
              transform: "translateX(-50%)",
              fontSize: "7px",
              fontFamily: "var(--font-mono, monospace)",
              background: "rgba(6,9,18,0.82)",
              border: `1px solid ${open ? col + "44" : "rgba(255,255,255,0.12)"}`,
              borderRadius: "3px",
              padding: "1px 4px",
              color: open ? col : "rgba(255,255,255,0.4)",
              letterSpacing: "0.1em",
              whiteSpace: "nowrap",
              pointerEvents: "none",
            }}>
              STK
            </div>

            {/* Diamond marker — square shape = STOCK, circle = CRYPTO, white diamond = CAPITAL */}
            <div
              style={{
                width: diamondSize,
                height: diamondSize,
                background: open ? col : "transparent",
                border: `2px solid ${col}`,
                borderRadius: "2px",
                transform: "rotate(45deg)",
                opacity: open ? 1 : 0.3,
                boxShadow: open
                  ? isHov
                    ? `0 0 14px ${col}, 0 0 28px ${col}66, 0 0 48px ${col}33`
                    : `0 0 10px ${col}, 0 0 22px ${col}55`
                  : "none",
                transition: "opacity 0.6s, box-shadow 0.6s, width 0.3s, height 0.3s",
              }}
            />

            {/* Ticker label below the diamond */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: `${Math.ceil(diamondSize * 0.7) + 8}px`,
                transform: "translateX(-50%)",
                whiteSpace: "nowrap",
                background: "rgba(8,11,20,0.88)",
                border: `1px solid ${col}${open ? "44" : "18"}`,
                borderRadius: "3px",
                padding: "1px 5px",
                fontSize: "8px",
                fontFamily: "var(--font-mono, monospace)",
                color: open ? col : `${col}55`,
                letterSpacing: "0.07em",
                transition: "color 0.6s, border-color 0.6s",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {market.name}
              {open && (
                <span
                  style={{
                    display: "inline-block",
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: col,
                    flexShrink: 0,
                    animation: "marker-pulse 2s ease-in-out infinite",
                  }}
                />
              )}
            </div>

            {/* Hover tooltip */}
            {isHov && (
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "-8px",
                  width: "178px",
                  background: "rgba(8,11,20,0.97)",
                  border: `1px solid ${col}44`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                  pointerEvents: "none",
                  zIndex: 300,
                  boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 0 1px ${col}18`,
                }}
              >
                {/* STOCK badge */}
                <div style={{ marginBottom: "5px" }}>
                  <span
                    style={{
                      fontSize: "8px",
                      background: `${col}22`,
                      border: `1px solid ${col}44`,
                      borderRadius: "3px",
                      padding: "1px 5px",
                      color: col,
                      fontFamily: "monospace",
                      letterSpacing: "0.1em",
                    }}
                  >
                    STOCK
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "6px",
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono, monospace)",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: col,
                    }}
                  >
                    {market.name}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      fontFamily: "var(--font-mono, monospace)",
                      color: open ? "#34d399" : "var(--fg-dim)",
                      border: `1px solid ${open ? "#34d39944" : "var(--fg-dim)44"}`,
                      borderRadius: "3px",
                      padding: "1px 5px",
                    }}
                  >
                    {open ? "OPEN" : "CLOSED"}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    color: "var(--fg-muted)",
                    fontFamily: "var(--font-mono, monospace)",
                    marginBottom: "6px",
                  }}
                >
                  {market.city}
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    color: "var(--fg-dim)",
                    fontFamily: "var(--font-mono, monospace)",
                    marginBottom: open ? 0 : "5px",
                  }}
                >
                  {market.openLocal.toFixed(0).padStart(2, "0")}:
                  {((market.openLocal % 1) * 60).toFixed(0).padStart(2, "0")} –{" "}
                  {market.closeLocal.toFixed(0).padStart(2, "0")}:
                  {((market.closeLocal % 1) * 60).toFixed(0).padStart(2, "0")}{" "}
                  local · Mon–Fri
                </div>

                {/* "Opens in Xh Ym" row when closed */}
                {!open && (
                  <div
                    style={{
                      fontSize: "9px",
                      color: col,
                      fontFamily: "var(--font-mono, monospace)",
                      opacity: 0.75,
                    }}
                  >
                    {getOpensIn(market, new Date())}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes marker-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
});
