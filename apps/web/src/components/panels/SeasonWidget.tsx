"use client";

import { memo, useState, useEffect } from "react";
import { getSunLatLng } from "@/lib/session-logic";
import { useLayer } from "@/hooks/useLayers";

const SEASON_EMOJI: Record<string, string> = {
  Spring: "🌱",
  Summer: "☀️",
  Autumn: "🍂",
  Winter: "❄️",
};

const OPPOSITE: Record<string, string> = {
  Spring: "Autumn",
  Summer: "Winter",
  Autumn: "Spring",
  Winter: "Summer",
};

function getNHSeason(doy: number): string {
  if (doy >= 80 && doy < 172) return "Spring";
  if (doy >= 172 && doy < 266) return "Summer";
  if (doy >= 266 && doy < 355) return "Autumn";
  return "Winter";
}

function computeSeasonData() {
  const now = new Date();
  const declination = getSunLatLng(now).lat;
  const doy = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
  );
  const nh = getNHSeason(doy);
  return { declination, nh, sh: OPPOSITE[nh] };
}

export const SeasonWidget = memo(function SeasonWidget() {
  const seasonVisible = useLayer("seasons");
  const [data, setData] = useState(computeSeasonData);

  // Refresh every 5 minutes — declination changes very slowly
  useEffect(() => {
    const id = setInterval(() => setData(computeSeasonData()), 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  if (!seasonVisible) return null;

  const { declination, nh, sh } = data;
  const angle = Math.abs(declination).toFixed(1);
  const decColor = declination >= 0 ? "#f59e0b" : "#60a5fa";

  return (
    <div
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
        EARTH SEASONS
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
        {/* NH */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <span style={{ fontSize: "8px", color: "var(--fg-dim)", fontFamily: "monospace" }}>NH</span>
          <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--fg)" }}>
            {SEASON_EMOJI[nh]} {nh}
          </span>
        </div>

        {/* Solar declination badge */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span
            style={{
              fontSize: "9px",
              fontFamily: "monospace",
              color: decColor,
              border: `1px solid ${decColor}44`,
              borderRadius: "3px",
              padding: "1px 5px",
            }}
          >
            {declination >= 0 ? "+" : "-"}{angle}°
          </span>
          <span style={{ fontSize: "7px", color: "var(--fg-dim)", fontFamily: "monospace", marginTop: "1px" }}>
            solar dec
          </span>
        </div>

        {/* SH */}
        <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: "flex-end" }}>
          <span style={{ fontSize: "8px", color: "var(--fg-dim)", fontFamily: "monospace" }}>SH</span>
          <span style={{ fontSize: "10px", fontFamily: "monospace", color: "var(--fg)" }}>
            {SEASON_EMOJI[sh]} {sh}
          </span>
        </div>
      </div>

      {/* Declination bar: left=SH max, center=equinox, right=NH max */}
      <div
        style={{
          height: "3px",
          background: "rgba(255,255,255,0.07)",
          borderRadius: "2px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: "1px",
            height: "100%",
            background: "rgba(255,255,255,0.2)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: declination >= 0 ? "50%" : `${50 + (declination / 23.45) * 50}%`,
            width: `${Math.abs(declination / 23.45) * 50}%`,
            height: "100%",
            background: decColor,
            borderRadius: "2px",
            transition: "width 0.8s, left 0.8s",
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: "2px",
          fontSize: "7px",
          color: "rgba(255,255,255,0.2)",
          fontFamily: "monospace",
        }}
      >
        <span>SH max</span>
        <span>equinox</span>
        <span>NH max</span>
      </div>
    </div>
  );
});
