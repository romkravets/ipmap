"use client";

import { useState, useEffect, useRef, memo } from "react";
import { EXCHANGES, SESSION_COLORS_HEX } from "@/lib/constants";
import type { GlobeMode } from "@sessionmap/types";

interface Position {
  x: number;
  y: number;
  visible: boolean;
}

declare global {
  interface Window {
    globeProject?: (lat: number, lng: number) => Position;
  }
}

interface ExchangeLabelsProps {
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  liveVol?: Map<string, number>;
  globeMode?: GlobeMode;
}

const MAX_STATIC_VOL = 76.4; // Binance vol — used for normalization

function heatColor(vol: number): string {
  const t = Math.min(1, vol / MAX_STATIC_VOL);
  if (t > 0.6) return `hsl(${Math.round(60 - t * 60)}, 100%, 60%)`; // yellow → red
  if (t > 0.2) return `hsl(${Math.round(120 - t * 100)}, 80%, 55%)`; // green → yellow
  return "hsl(120, 60%, 40%)"; // dim green for low volume
}

function getExchangeTier(vol: number): 1 | 2 | 3 {
  if (vol >= 20) return 1;
  if (vol >= 5) return 2;
  return 3;
}

function getSessionLabel(region: string): string {
  switch (region) {
    case "asia":     return "Asia Session";
    case "europe":   return "Europe Session";
    case "americas": return "Americas Session";
    default:         return region.charAt(0).toUpperCase() + region.slice(1);
  }
}

export const ExchangeLabels = memo(function ExchangeLabels({
  hoveredId,
  onHover,
  liveVol,
  globeMode,
}: ExchangeLabelsProps) {
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const update = () => {
      if (!window.globeProject) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }
      const next: Record<string, Position> = {};
      EXCHANGES.forEach((ex) => {
        next[ex.id] = window.globeProject!(ex.lat, ex.lng);
      });
      setPositions(next);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {EXCHANGES.map((ex) => {
        const pos = positions[ex.id];
        if (!pos?.visible) return null;
        const isHovered = hoveredId === ex.id;
        const displayVol = liveVol?.get(ex.id) ?? ex.vol;
        const col =
          globeMode === "heatmap"
            ? heatColor(displayVol)
            : SESSION_COLORS_HEX[ex.region];
        const tier = getExchangeTier(displayVol);

        // Tier-based sizes
        const outerSize = tier === 1 ? 14 : tier === 2 ? 11 : 0;
        const innerSize = tier === 1 ? 8 : tier === 2 ? 6 : 6;
        const glowSize  = tier === 1 ? 16 : tier === 2 ? 10 : 6;

        // Heatmap mode overrides dot size
        const heatmapDotSize =
          globeMode === "heatmap"
            ? Math.max(5, Math.min(14, Math.round((displayVol / MAX_STATIC_VOL) * 14)))
            : null;

        return (
          <div
            key={ex.id}
            onMouseEnter={() => onHover(ex.id)}
            onMouseLeave={() => onHover(null)}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "all",
              cursor: "pointer",
              zIndex: isHovered ? 100 : Math.floor(ex.vol),
            }}
          >
            {/* Amber outer halo — marks all crypto exchanges, visually distinct from blue STOCK squares */}
            <div style={{
              position: "absolute",
              width: (tier === 1 ? 14 : tier === 2 ? 11 : 8) + 10,
              height: (tier === 1 ? 14 : tier === 2 ? 11 : 8) + 10,
              borderRadius: "50%",
              border: `1px solid rgba(251,176,64,${isHovered ? 0.5 : 0.18})`,
              top: "50%", left: "50%",
              transform: "translate(-50%,-50%)",
              pointerEvents: "none",
              transition: "border-color 0.2s",
            }} />

            {/* CRYPTO badge — always visible for tier 1 */}
            {tier === 1 && !isHovered && (
              <div style={{
                position: "absolute",
                left: "50%",
                top: "-32px",
                transform: "translateX(-50%)",
                fontSize: "7px",
                fontFamily: "var(--font-mono, monospace)",
                background: "rgba(6,9,18,0.82)",
                border: "1px solid rgba(251,176,64,0.3)",
                borderRadius: "3px",
                padding: "1px 4px",
                color: "rgba(251,176,64,0.88)",
                letterSpacing: "0.08em",
                whiteSpace: "nowrap",
                pointerEvents: "none",
              }}>
                ₿
              </div>
            )}

            {/* Marker: tier 1/2 = ring + dot, tier 3 = dot only */}
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {/* Outer ring (tier 1 & 2 only) */}
              {tier < 3 && globeMode !== "heatmap" && (
                <div
                  style={{
                    position: "absolute",
                    width: outerSize,
                    height: outerSize,
                    borderRadius: "50%",
                    border: `1.5px solid ${col}`,
                    opacity: isHovered ? 1 : 0.65,
                    boxShadow: isHovered
                      ? `0 0 ${tier === 1 ? 14 : 8}px ${col}, 0 0 ${tier === 1 ? 28 : 16}px ${col}44`
                      : `0 0 ${tier === 1 ? 8 : 5}px ${col}88`,
                    transition: "opacity 0.2s, box-shadow 0.2s",
                  }}
                />
              )}
              {/* Inner dot */}
              <div
                style={{
                  width: heatmapDotSize ?? innerSize,
                  height: heatmapDotSize ?? innerSize,
                  borderRadius: "50%",
                  background: col,
                  boxShadow: isHovered
                    ? `0 0 ${glowSize}px ${col}, 0 0 ${glowSize * 2}px ${col}55`
                    : `0 0 ${tier === 1 ? 8 : tier === 2 ? 6 : 4}px ${col}${isHovered ? "" : "99"}`,
                  transition: "box-shadow 0.2s, background 0.4s",
                  flexShrink: 0,
                }}
              />
            </div>

            {/* Name label for tier-1 exchanges or hovered */}
            {(tier === 1 || isHovered) && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "-22px",
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  background: "rgba(10,14,26,0.88)",
                  border: `1px solid ${col}44`,
                  borderRadius: "4px",
                  padding: "2px 7px",
                  fontSize: "9px",
                  fontFamily: "var(--font-mono, monospace)",
                  color: col,
                  letterSpacing: "0.06em",
                  pointerEvents: "none",
                }}
              >
                {ex.name}
              </div>
            )}

            {/* Hover tooltip */}
            {isHovered && (
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "-10px",
                  width: "190px",
                  background: "rgba(8,11,20,0.97)",
                  border: `1px solid ${col}55`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                  pointerEvents: "none",
                  zIndex: 200,
                  boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px ${col}22`,
                }}
              >
                {/* CRYPTO badge */}
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
                    CRYPTO
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    marginBottom: "7px",
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
                    {ex.name}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      color: "var(--fg-muted)",
                      fontFamily: "var(--font-mono, monospace)",
                    }}
                  >
                    {ex.year}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: "9px",
                    color: "var(--fg-muted)",
                    marginBottom: "8px",
                    fontFamily: "var(--font-mono, monospace)",
                  }}
                >
                  {ex.city}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "4px 8px",
                  }}
                >
                  {(
                    [
                      ["24h Vol", `$${displayVol.toFixed(1)}B`],
                      ["Share", `${ex.share}%`],
                      ["Pairs", ex.pairs.toLocaleString()],
                      ["Region", ex.region.charAt(0).toUpperCase() + ex.region.slice(1)],
                      ["Status", getSessionLabel(ex.region)],
                      ["Tier", `Tier ${tier}`],
                    ] as [string, string][]
                  ).map(([k, v]) => (
                    <span key={k} style={{ display: "contents" }}>
                      <span
                        style={{
                          fontSize: "9px",
                          color: "var(--fg-muted)",
                          fontFamily: "var(--font-mono, monospace)",
                        }}
                      >
                        {k}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--fg)",
                          fontFamily: "var(--font-mono, monospace)",
                          fontWeight: 500,
                        }}
                      >
                        {v}
                      </span>
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    height: "2px",
                    background: "rgba(255,255,255,0.07)",
                    borderRadius: "2px",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, ex.share * 3)}%`,
                      height: "100%",
                      background: col,
                      borderRadius: "2px",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "8px",
                    color: "var(--fg-muted)",
                    fontFamily: "var(--font-mono, monospace)",
                    marginTop: "3px",
                  }}
                >
                  market share
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
