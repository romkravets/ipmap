"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import type { GlobeMode } from "@ipmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";
import { useIpData } from "@/hooks/useIpData";

const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);

function IpMapApp() {
  const { state, dispatch } = useAppContext();
  const { globeMode, tweaks } = state;
  const { countries, isLoading } = useIpData();
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const onGlobeModeChange = (mode: GlobeMode) => {
    dispatch({ type: "SET_GLOBE_MODE", payload: mode });
    window.globeState?.setMode(mode);
  };

  void onGlobeModeChange; // використовується в TweaksPanel через globeState

  return (
    <>
      <LoadingBar />
      <GlobeScene
        mode={globeMode}
        tweaks={tweaks}
        countries={countries}
        onCountryClick={setSelectedCountry}
      />
      {isLoading && (
        <div style={{ position: 'fixed', top: 16, left: 16, color: '#aaa', fontSize: 12, zIndex: 20 }}>
          Завантаження IP-даних...
        </div>
      )}
      {selectedCountry && (
        <div style={{ position: 'fixed', top: 16, right: 16, color: '#fff', fontSize: 13, zIndex: 20, background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: 6 }}>
          {selectedCountry}
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
