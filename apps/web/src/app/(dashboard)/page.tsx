"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import type { GlobeMode, IpBlock } from "@ipmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";
import { CountryPanel } from "@/components/panels/CountryPanel";
import { BlockPanel } from "@/components/panels/BlockPanel";
const LayerTogglePanel = dynamic(
  () => import("@/components/panels/LayerTogglePanel").then((m) => m.LayerTogglePanel),
  { ssr: false },
);
import { useIpData } from "@/hooks/useIpData";
import { useInfraData } from "@/hooks/useInfraData";

const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);

function IpMapApp() {
  const { state, dispatch } = useAppContext();
  const { globeMode, tweaks } = state;
  const { countries, blocksByCountry, isLoading } = useIpData();
  const { cables, dataCenters, ixps } = useInfraData();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<IpBlock | null>(null);
  const [hoveredBlock, setHoveredBlock] = useState<{ block: IpBlock; x: number; y: number } | null>(null);

  const countryData = selectedCountry
    ? countries.find((c) => c.cc === selectedCountry) ?? null
    : null;
  const countryBlocks = selectedCountry
    ? (blocksByCountry[selectedCountry] ?? [])
    : [];

  const onGlobeModeChange = (mode: GlobeMode) => {
    dispatch({ type: "SET_GLOBE_MODE", payload: mode });
    window.globeState?.setMode(mode);
  };

  void onGlobeModeChange; // використовується в TweaksPanel через globeState

  const handleBack = () => {
    setSelectedCountry(null);
    setSelectedBlock(null);
  };

  const handleBlockClick = (block: IpBlock) => {
    setSelectedBlock(block);
  };

  const handleBlockHover = (block: IpBlock | null, x: number, y: number) => {
    setHoveredBlock(block ? { block, x, y } : null);
  };

  // Close BlockPanel with Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedBlock(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close BlockPanel when clicking empty canvas space (not hovering a block)
  const handleCanvasPointerDown = () => {
    if (!hoveredBlock) setSelectedBlock(null);
  };

  return (
    <>
      <LoadingBar />
      <GlobeScene
        mode={globeMode}
        tweaks={tweaks}
        countries={countries}
        selectedCountry={selectedCountry}
        countryData={countryData}
        countryBlocks={countryBlocks}
        onCountryClick={setSelectedCountry}
        onBlockClick={handleBlockClick}
        onBlockHover={handleBlockHover}
        onCanvasPointerDown={handleCanvasPointerDown}
        cables={cables}
        dataCenters={dataCenters}
        ixps={ixps}
      />
      {isLoading && (
        <div
          style={{
            position: "fixed",
            top: 16,
            left: 16,
            color: "#aaa",
            fontSize: 12,
            zIndex: 20,
          }}
        >
          Завантаження IP-даних...
        </div>
      )}
      {countryData && (
        <CountryPanel
          country={countryData}
          blockCount={countryBlocks.length}
          onBack={handleBack}
        />
      )}
      {selectedBlock && (
        <BlockPanel
          block={selectedBlock}
          onClose={() => setSelectedBlock(null)}
        />
      )}
      <TweaksPanel />
      <LayerTogglePanel />
      {hoveredBlock && (
        <div
          style={{
            position: "fixed",
            left: hoveredBlock.x + 14,
            top: hoveredBlock.y + 14,
            background: "rgba(0,0,0,0.78)",
            color: "#e2e8f0",
            fontSize: 12,
            padding: "6px 10px",
            borderRadius: 6,
            pointerEvents: "none",
            zIndex: 50,
            whiteSpace: "nowrap",
            border: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ fontFamily: "monospace" }}>{hoveredBlock.block.start}</div>
          <div style={{ color: "#94a3b8" }}>
            {hoveredBlock.block.size.toLocaleString()} addresses
          </div>
        </div>
      )}
    </>
  );
}

export default function HomePage() {
  return (
    <AppProvider>
      <IpMapApp />
    </AppProvider>
  );
}
