"use client";

import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import type { GlobeMode } from "@ipmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";

const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);

function IpMapApp() {
  const { state, dispatch } = useAppContext();
  const { globeMode, tweaks } = state;

  const onGlobeModeChange = (mode: GlobeMode) => {
    dispatch({ type: "SET_GLOBE_MODE", payload: mode });
    if (typeof window !== "undefined") {
      window.globeState?.setMode(mode);
    }
  };

  return (
    <>
      <LoadingBar />
      <GlobeScene mode={globeMode} tweaks={tweaks} />
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
