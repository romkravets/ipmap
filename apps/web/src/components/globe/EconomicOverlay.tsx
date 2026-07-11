"use client";

import { useState, useEffect, useRef, memo } from "react";
import { ECONOMIC_POINTS, ECONOMIC_COLORS, ECONOMIC_LABELS } from "@/lib/economic-data";
import type { EconomicPoint, EconomicType } from "@/lib/economic-data";
import { useLayer } from "@/hooks/useLayers";

interface Position {
  x: number;
  y: number;
  visible: boolean;
}

function useCamDist(): number {
  const distRef = useRef<number>(2.5);
  const [dist, setDist] = useState(2.5);
  useEffect(() => {
    let raf: number;
    const poll = () => {
      const d = window.globeCamDist ?? 2.5;
      if (Math.abs(d - distRef.current) > 0.02) {
        distRef.current = d;
        setDist(d);
      }
      raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(raf);
  }, []);
  return dist;
}

// Marker size by tier
const TIER_SIZE: Record<1 | 2 | 3, number> = { 1: 8, 2: 6, 3: 5 };

// Which types use which shape
function getShape(type: EconomicType): "circle" | "triangle-up" | "triangle-down" | "diamond" {
  if (type === "port" || type === "airport" || type === "industrial") return "circle";
  if (type === "oil" || type === "gas") return "triangle-up";
  if (type === "gold" || type === "diamond") return "diamond";
  // copper, iron, coal, bauxite, uranium
  return "triangle-down";
}

interface MarkerProps {
  size: number;
  color: string;
  shape: ReturnType<typeof getShape>;
  isHovered: boolean;
}

function Marker({ size, color, shape, isHovered }: MarkerProps) {
  const glow = isHovered
    ? `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}55`
    : `0 0 ${size}px ${color}99`;

  if (shape === "circle") {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: color,
          boxShadow: glow,
          transition: "box-shadow 0.2s",
          flexShrink: 0,
        }}
      />
    );
  }

  if (shape === "diamond") {
    return (
      <div
        style={{
          width: size,
          height: size,
          background: color,
          transform: "rotate(45deg)",
          boxShadow: glow,
          transition: "box-shadow 0.2s",
          flexShrink: 0,
        }}
      />
    );
  }

  if (shape === "triangle-up") {
    return (
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: `${size - 2}px solid transparent`,
          borderRight: `${size - 2}px solid transparent`,
          borderBottom: `${size + 1}px solid ${color}`,
          filter: isHovered ? `drop-shadow(0 0 ${size / 2}px ${color})` : `drop-shadow(0 0 ${size / 4}px ${color}99)`,
          transition: "filter 0.2s",
          flexShrink: 0,
        }}
      />
    );
  }

  // triangle-down
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: `${size - 2}px solid transparent`,
        borderRight: `${size - 2}px solid transparent`,
        borderTop: `${size + 1}px solid ${color}`,
        filter: isHovered ? `drop-shadow(0 0 ${size / 2}px ${color})` : `drop-shadow(0 0 ${size / 4}px ${color}99)`,
        transition: "filter 0.2s",
        flexShrink: 0,
      }}
    />
  );
}

interface TooltipProps {
  point: EconomicPoint;
  color: string;
  label: string;
}

function Tooltip({ point, color, label }: TooltipProps) {
  return (
    <div
      style={{
        position: "absolute",
        left: "14px",
        top: "-10px",
        width: "190px",
        background: "rgba(8,11,20,0.97)",
        border: `1px solid ${color}55`,
        borderRadius: "8px",
        padding: "10px 12px",
        pointerEvents: "none",
        zIndex: 200,
        boxShadow: `0 4px 24px rgba(0,0,0,0.6), 0 0 0 1px ${color}22`,
      }}
    >
      {/* Type badge */}
      <div style={{ marginBottom: "5px" }}>
        <span
          style={{
            fontSize: "8px",
            background: `${color}22`,
            border: `1px solid ${color}44`,
            borderRadius: "3px",
            padding: "1px 5px",
            color: color,
            fontFamily: "monospace",
            letterSpacing: "0.1em",
          }}
        >
          {label}
        </span>
      </div>

      {/* Name row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "4px",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "12px",
            fontWeight: 600,
            color: color,
          }}
        >
          {point.name}
        </span>
        <span
          style={{
            fontSize: "8px",
            color: "rgba(255,255,255,0.3)",
            fontFamily: "var(--font-mono, monospace)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "3px",
            padding: "1px 4px",
          }}
        >
          T{point.tier}
        </span>
      </div>

      {/* Country */}
      <div
        style={{
          fontSize: "9px",
          color: "var(--fg-muted, rgba(255,255,255,0.45))",
          fontFamily: "var(--font-mono, monospace)",
          marginBottom: "6px",
        }}
      >
        {point.country}
      </div>

      {/* Detail */}
      <div
        style={{
          fontSize: "9px",
          color: "rgba(255,255,255,0.6)",
          fontFamily: "var(--font-mono, monospace)",
          lineHeight: 1.4,
        }}
      >
        {point.detail}
      </div>
    </div>
  );
}

export const EconomicOverlay = memo(function EconomicOverlay() {
  const visible = useLayer("resources");
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const rafRef = useRef<number>(0);
  const camDist = useCamDist();

  useEffect(() => {
    const update = () => {
      if (!window.globeProject) {
        rafRef.current = requestAnimationFrame(update);
        return;
      }
      const next: Record<string, Position> = {};
      ECONOMIC_POINTS.forEach((pt) => {
        next[pt.id] = window.globeProject!(pt.lat, pt.lng);
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
      {ECONOMIC_POINTS.map((pt) => {
        const pos = positions[pt.id];
        if (!pos?.visible) return null;

        const isHov = hoveredId === pt.id;
        // tier 2 hidden until zoomed in (dist ≤ 2.2); tier 3 until very close (dist ≤ 1.7)
        if (pt.tier === 2 && camDist > 2.2 && !isHov) return null;
        if (pt.tier === 3 && camDist > 1.7 && !isHov) return null;

        const color = ECONOMIC_COLORS[pt.type];
        const label = ECONOMIC_LABELS[pt.type];
        const shape = getShape(pt.type);
        const size = TIER_SIZE[pt.tier];

        return (
          <div
            key={pt.id}
            onMouseEnter={() => setHoveredId(pt.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "all",
              cursor: "default",
              zIndex: isHov ? 150 : pt.tier === 1 ? 15 : 10,
            }}
          >
            {/* Category badge — tier 1 only, not shown while hovered (tooltip replaces) */}
            {pt.tier === 1 && !isHov && (
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
                  letterSpacing: "0.08em",
                  whiteSpace: "nowrap",
                  pointerEvents: "none",
                }}
              >
                {label.slice(0, 3)}
              </div>
            )}

            {/* Marker shape */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Marker
                size={isHov ? size + 2 : size}
                color={color}
                shape={shape}
                isHovered={isHov}
              />
            </div>

            {/* Hover tooltip */}
            {isHov && (
              <Tooltip point={pt} color={color} label={label} />
            )}
          </div>
        );
      })}
    </div>
  );
});
