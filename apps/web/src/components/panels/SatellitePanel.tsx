"use client";

import type { SatelliteGroup } from "@ipmap/types";
import type { SatelliteLayerData } from "@/lib/layers/satellites";
import { SATELLITE_GROUPS } from "@/lib/satellites/omm";
import { useLayer } from "@/hooks/useLayers";

const GROUP_LABELS: Record<SatelliteGroup, string> = {
  stations: "Stations",
  starlink: "Starlink",
  oneweb: "OneWeb",
  "gps-ops": "GPS",
  galileo: "Galileo",
  weather: "Weather",
};

interface Props {
  enabled: SatelliteGroup[];
  data: SatelliteLayerData;
  loading: SatelliteGroup[];
  errors: Partial<Record<SatelliteGroup, string>>;
  onToggle: (g: SatelliteGroup) => void;
}

export function SatellitePanel({ enabled, data, loading, errors, onToggle }: Props) {
  const visible = useLayer("satellites");
  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        width: 300,
        maxWidth: "calc(100vw - 32px)",
        zIndex: 400,
        background: "rgba(0,0,0,0.78)",
        color: "#e2e8f0",
        fontSize: 12,
        padding: "8px 12px",
        borderRadius: 6,
        border: "1px solid rgba(255,255,255,0.12)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ fontWeight: 700 }}>Супутники</div>
      {SATELLITE_GROUPS.map((g) => (
        <label key={g} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={enabled.includes(g)} onChange={() => onToggle(g)} />
          {GROUP_LABELS[g]}
        </label>
      ))}
      {enabled.map((g) => {
        const items = data[g];
        return (
          <div key={g} style={{ color: errors[g] ? "#f87171" : "#94a3b8" }}>
            {errors[g]
              ? `${GROUP_LABELS[g]}: ${errors[g]}`
              : loading.includes(g)
                ? `${GROUP_LABELS[g]}: Завантаження...`
                : items
                  ? `${GROUP_LABELS[g]} на орбіті зараз: ${items.length}`
                  : null}
          </div>
        );
      })}
    </div>
  );
}
