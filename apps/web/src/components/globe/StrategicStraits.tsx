"use client";

import { useState, useEffect, useRef, memo } from "react";
import { useLayer } from "@/hooks/useLayers";

interface Strait {
  id: string;
  name: string;
  lat: number;
  lng: number;
  traffic: string;
  detail: string;
  color: string;
}

const STRAITS: Strait[] = [
  {
    id: "hormuz",
    name: "Strait of Hormuz",
    lat: 26.6,
    lng: 56.3,
    traffic: "~20% world oil",
    detail: "Narrowest chokepoint for Persian Gulf oil; Iran/Oman coast. ~17-18 Mb/d crude pass through daily.",
    color: "#f97316",
  },
  {
    id: "malacca",
    name: "Strait of Malacca",
    lat: 2.5,
    lng: 102.0,
    traffic: "~30% world trade",
    detail: "Busiest shipping lane on Earth connecting Indian Ocean to South China Sea; ~100,000 vessels/year.",
    color: "#a78bfa",
  },
  {
    id: "suez",
    name: "Suez Canal",
    lat: 30.7,
    lng: 32.3,
    traffic: "~12% world trade",
    detail: "Critical Egypt canal linking Mediterranean to Red Sea; ~19,000 ships/year. Closure in 2021 cost ~$9.6B/day.",
    color: "#34d399",
  },
  {
    id: "gibraltar",
    name: "Strait of Gibraltar",
    lat: 35.9,
    lng: -5.6,
    traffic: "~10% world trade",
    detail: "Gateway between Atlantic and Mediterranean; separates Spain from Morocco. Major NATO maritime corridor.",
    color: "#60a5fa",
  },
  {
    id: "panama",
    name: "Panama Canal",
    lat: 9.1,
    lng: -79.7,
    traffic: "~5% world trade",
    detail: "82 km canal linking Atlantic and Pacific; ~14,000 ships/year. Saves ~8,000 km vs. Cape Horn route.",
    color: "#fbbf24",
  },
  {
    id: "danish",
    name: "Danish Straits",
    lat: 57.0,
    lng: 10.6,
    traffic: "~3% world oil",
    detail: "Only maritime access to Baltic Sea (Øresund + Belt straits); critical for Russian energy exports and Nordic trade.",
    color: "#f472b6",
  },
];

interface Position { x: number; y: number; visible: boolean; }

export const StrategicStraits = memo(function StrategicStraits() {
  const visible = useLayer("straits");
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const update = () => {
      if (!window.globeProject) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }
      const next: Record<string, Position> = {};
      STRAITS.forEach((s) => {
        next[s.id] = window.globeProject!(s.lat, s.lng);
      });
      setPositions(next);
      rafRef.current = requestAnimationFrame(update);
    };
    rafRef.current = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  if (!visible) return null;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {STRAITS.map((strait) => {
        const pos = positions[strait.id];
        if (!pos?.visible) return null;
        const isHov = hoveredId === strait.id;
        const { color } = strait;

        return (
          <div
            key={strait.id}
            onMouseEnter={() => setHoveredId(strait.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "all",
              cursor: "default",
              zIndex: isHov ? 160 : 25,
            }}
          >
            {/* Hexagon-ish marker: two stacked triangles via border trick */}
            <div
              style={{
                position: "relative",
                width: isHov ? 14 : 10,
                height: isHov ? 14 : 10,
                background: isHov ? color : `${color}cc`,
                clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
                boxShadow: isHov
                  ? `0 0 12px ${color}, 0 0 24px ${color}66`
                  : `0 0 6px ${color}99`,
                transition: "width 0.2s, height 0.2s, box-shadow 0.2s",
              }}
            />

            {/* Traffic label above */}
            {!isHov && (
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "-18px",
                  transform: "translateX(-50%)",
                  fontSize: "7px",
                  fontFamily: "var(--font-mono, monospace)",
                  background: "rgba(6,9,18,0.82)",
                  border: `1px solid ${color}44`,
                  borderRadius: "3px",
                  padding: "1px 4px",
                  color: `${color}dd`,
                  letterSpacing: "0.06em",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {strait.traffic}
              </div>
            )}

            {/* Hover tooltip */}
            {isHov && (
              <div
                style={{
                  position: "absolute",
                  left: "14px",
                  top: "-12px",
                  width: "200px",
                  background: "rgba(8,11,20,0.97)",
                  border: `1px solid ${color}55`,
                  borderRadius: "8px",
                  padding: "10px 12px",
                  pointerEvents: "none",
                  zIndex: 300,
                  boxShadow: `0 4px 24px rgba(0,0,0,0.7), 0 0 0 1px ${color}22`,
                }}
              >
                {/* Type badge */}
                <div style={{ marginBottom: "5px" }}>
                  <span style={{
                    fontSize: "8px",
                    background: `${color}22`,
                    border: `1px solid ${color}44`,
                    borderRadius: "3px",
                    padding: "1px 5px",
                    color: color,
                    fontFamily: "monospace",
                    letterSpacing: "0.1em",
                  }}>
                    CHOKEPOINT
                  </span>
                </div>

                {/* Name */}
                <div style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: color,
                  fontFamily: "var(--font-mono, monospace)",
                  marginBottom: "4px",
                }}>
                  {strait.name}
                </div>

                {/* Traffic badge */}
                <div style={{
                  fontSize: "9px",
                  color: `${color}cc`,
                  fontFamily: "var(--font-mono, monospace)",
                  marginBottom: "6px",
                  fontWeight: 600,
                }}>
                  {strait.traffic}
                </div>

                {/* Detail */}
                <div style={{
                  fontSize: "9px",
                  color: "rgba(255,255,255,0.6)",
                  fontFamily: "var(--font-mono, monospace)",
                  lineHeight: 1.4,
                }}>
                  {strait.detail}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});
