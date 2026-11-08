"use client";

import { useState } from "react";
import type { SatelliteGroup } from "@ipmap/types";
import { createPropagator } from "@/lib/satellites/propagator";
import { KREMENETS, visibleAbove, type Observer } from "@/lib/satellites/observer";
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
  observer?: Observer;
  nowMs?: number;
}

const MAX_ROWS = 10;

interface Row {
  name: string;
  elevationDeg: number;
}

export function SatellitePanel({ enabled, data, loading, errors, onToggle, observer = KREMENETS, nowMs }: Props) {
  const visible = useLayer("satellites");
  const [rows, setRows] = useState<Row[] | null>(null);
  if (!visible) return null;

  const loadedGroups = enabled.filter((g) => (data[g]?.length ?? 0) > 0);

  // Обчислення лише за кліком, в головному потоці
  const computeNow = () => {
    const omms = loadedGroups.flatMap((g) => data[g] ?? []);
    const names = omms.map((o) => o.OBJECT_NAME);
    const prop = createPropagator();
    prop.load(omms);
    setRows(
      visibleAbove(prop.lookAt(nowMs ?? Date.now(), observer))
        .slice(0, MAX_ROWS)
        .map((v) => ({ name: names[v.index], elevationDeg: v.elevationDeg })),
    );
  };

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
      <button type="button" disabled={loadedGroups.length === 0} onClick={computeNow}>
        Над Кременцем зараз
      </button>
      {rows &&
        (rows.length === 0 ? (
          <div style={{ color: "#94a3b8" }}>Зараз над Кременцем немає супутників вище 10°</div>
        ) : (
          rows.map((r, i) => <div key={i}>{`${r.name} — ${r.elevationDeg.toFixed(1)}°`}</div>)
        ))}
    </div>
  );
}
