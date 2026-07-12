"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import type { GlobeMode, IpBlock, InfraHoverInfo } from "@ipmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";
import { CountryPanel } from "@/components/panels/CountryPanel";
import { BlockPanel } from "@/components/panels/BlockPanel";
import { getProviderLabel } from "@/lib/infraLabels";
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
  const [hoveredInfra, setHoveredInfra] = useState<{ info: InfraHoverInfo; x: number; y: number } | null>(null);

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

  const handleInfraHover = (info: InfraHoverInfo | null, x: number, y: number) => {
    setHoveredInfra(info ? { info, x, y } : null);
  };

  // Close BlockPanel with Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedBlock(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        selectedBlock={selectedBlock}
        onCountryClick={setSelectedCountry}
        onBlockClick={handleBlockClick}
        onBlockHover={handleBlockHover}
        onInfraHover={handleInfraHover}
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
      {hoveredInfra && (
        <div
          style={{
            position: "fixed",
            left: hoveredInfra.x + 14,
            top: hoveredInfra.y + 14,
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
          {hoveredInfra.info.kind === "datacenter" ? (
            <>
              <div style={{ fontWeight: 700 }}>{hoveredInfra.info.item.name}</div>
              <div style={{ color: "#94a3b8" }}>{getProviderLabel(hoveredInfra.info.item.provider)}</div>
              <div style={{ color: "#94a3b8" }}>
                {hoveredInfra.info.item.city}, {hoveredInfra.info.item.country}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700 }}>{hoveredInfra.info.item.name}</div>
              <div style={{ color: "#94a3b8" }}>
                {hoveredInfra.info.item.city}, {hoveredInfra.info.item.country}
              </div>
              <div style={{ color: "#94a3b8" }}>
                {hoveredInfra.info.item.netCount.toLocaleString()} мереж-учасників
              </div>
            </>
          )}
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
