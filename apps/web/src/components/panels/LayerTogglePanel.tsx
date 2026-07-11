"use client";

import { useState } from "react";
import { useLayerControls } from "@/hooks/useLayers";
import type { LayerKey } from "@/hooks/useLayers";

interface LayerDef {
  key: LayerKey;
  label: string;
  icon: string;
}

const LAYERS: LayerDef[] = [
  { key: "cities",    label: "Cities",    icon: "◆" },
  { key: "resources", label: "Resources", icon: "▲" },
  { key: "straits",   label: "Straits",   icon: "⬡" },
  { key: "cables",    label: "Cables",    icon: "∿" },
  { key: "borders",   label: "Borders",   icon: "▭" },
  { key: "seasons",   label: "Seasons",   icon: "◑" },
];

const ACTIVE_COLORS: Record<LayerKey, string> = {
  cities:    "#e2e8f0",
  resources: "#f97316",
  straits:   "#f472b6",
  cables:    "#22d3ee",
  borders:   "#7dba8c",
  seasons:   "#fbbf24",
};

export function LayerTogglePanel() {
  const [open, setOpen] = useState(false);
  const [layers, toggle] = useLayerControls();

  const activeCount = Object.values(layers).filter(Boolean).length;

  return (
    <div
      style={{
        position: "absolute",
        top: "46px",
        right: "16px",
        pointerEvents: "all",
        zIndex: 400,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "6px",
        userSelect: "none",
      }}
    >
      {/* Toggle button — sits at top, dropdown opens below */}
      <button
        onClick={() => setOpen((p) => !p)}
        title="Toggle layers"
        style={{
          height: "26px",
          borderRadius: "6px",
          background: open ? "rgba(34,211,238,0.12)" : "none",
          border: `1px solid ${open ? "rgba(34,211,238,0.35)" : "rgba(255,255,255,0.08)"}`,
          cursor: "pointer",
          color: open ? "#22d3ee" : "rgba(255,255,255,0.55)",
          fontSize: "11px",
          fontFamily: "var(--font-mono, monospace)",
          letterSpacing: "0.08em",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "0 10px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          transition: "background 0.2s, border-color 0.2s, color 0.2s",
          position: "relative",
        }}
      >
        <span style={{ fontSize: "13px" }}>⊞</span>
        Layers
        {/* Hidden-layer count badge */}
        {!open && activeCount < LAYERS.length && (
          <div
            style={{
              position: "absolute",
              top: "-4px",
              right: "-4px",
              width: "13px",
              height: "13px",
              borderRadius: "50%",
              background: "#f97316",
              border: "1px solid rgba(8,11,20,0.9)",
              fontSize: "8px",
              fontFamily: "var(--font-mono, monospace)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            {activeCount}
          </div>
        )}
      </button>

      {/* Layer rows — expand downward */}
      {open && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            alignItems: "flex-end",
          }}
        >
          {LAYERS.map((layer) => {
            const on = layers[layer.key];
            const col = ACTIVE_COLORS[layer.key];
            return (
              <button
                key={layer.key}
                onClick={() => toggle(layer.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: on ? "rgba(8,11,20,0.92)" : "rgba(8,11,20,0.72)",
                  border: `1px solid ${on ? col + "50" : "rgba(255,255,255,0.07)"}`,
                  borderRadius: "6px",
                  padding: "5px 10px",
                  cursor: "pointer",
                  color: on ? col : "rgba(255,255,255,0.28)",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  transition: "border-color 0.2s, color 0.2s, background 0.2s",
                  boxShadow: on ? `0 0 0 1px ${col}18, 0 2px 10px rgba(0,0,0,0.5)` : "0 1px 6px rgba(0,0,0,0.35)",
                  minWidth: "128px",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                  <span style={{ fontSize: "9px", opacity: on ? 0.85 : 0.25 }}>{layer.icon}</span>
                  <span>{layer.label}</span>
                </div>
                {/* Toggle pill */}
                <div
                  style={{
                    width: "22px",
                    height: "11px",
                    borderRadius: "6px",
                    background: on ? col : "rgba(255,255,255,0.07)",
                    border: `1px solid ${on ? col + "60" : "rgba(255,255,255,0.10)"}`,
                    position: "relative",
                    transition: "background 0.18s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "1px",
                      left: on ? "10px" : "1px",
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: on ? "rgba(8,11,20,0.9)" : "rgba(255,255,255,0.18)",
                      transition: "left 0.16s",
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
