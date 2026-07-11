"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import type { GlobeMode, IpBlock } from "@ipmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";
import { CountryPanel } from "@/components/panels/CountryPanel";
import { useIpData } from "@/hooks/useIpData";

const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);

function IpMapApp() {
  const { state, dispatch } = useAppContext();
  const { globeMode, tweaks } = state;
  const { countries, blocksByCountry, isLoading } = useIpData();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<IpBlock | null>(null);

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
    console.log("[ipmap] block clicked:", block);
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
        <div
          style={{
            position: "fixed",
            bottom: 16,
            left: 16,
            zIndex: 50,
            background: "rgba(0,0,0,0.75)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 8,
            padding: "10px 14px",
            color: "#fff",
            fontFamily: "monospace",
            fontSize: 12,
          }}
        >
          <div style={{ color: "#60a5fa", marginBottom: 4 }}>Вибраний блок</div>
          <div>Старт: {selectedBlock.start}</div>
          <div>Розмір: {selectedBlock.size.toLocaleString()} адрес</div>
        </div>
      )}
      <TweaksPanel />
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
