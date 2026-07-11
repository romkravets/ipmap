"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { AppProvider, useAppContext } from "@/contexts/AppContext";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSession } from "@/hooks/useSession";
import { useWhaleEvents } from "@/hooks/useWhaleEvents";
import { useSparklines } from "@/hooks/useSparklines";
import { useLiveExchanges } from "@/hooks/useLiveExchanges";
import { usePriceAlerts } from "@/hooks/usePriceAlerts";
import { useStockTicker } from "@/hooks/useStockTicker";
import { useCorrelation } from "@/hooks/useCorrelation";
import { getSunLatLng } from "@/lib/session-logic";
import type { GlobeMode } from "@sessionmap/types";
import { TweaksPanel } from "@/components/panels/TweaksPanel";
import { PriceAlertsPanel } from "@/components/panels/PriceAlertsPanel";
import { LoadingBar } from "@/components/panels/LoadingBar";

// ── Dynamic imports (no SSR) ──────────────────────────────────────────────────
const GlobeScene = dynamic(
  () => import("@/components/globe/GlobeScene").then((m) => m.GlobeScene),
  { ssr: false },
);
const ExchangeLabels = dynamic(
  () =>
    import("@/components/globe/ExchangeLabels").then((m) => m.ExchangeLabels),
  { ssr: false },
);
const StockMarketLabels = dynamic(
  () =>
    import("@/components/globe/StockMarketLabels").then(
      (m) => m.StockMarketLabels,
    ),
  { ssr: false },
);
const WorldCapitals = dynamic(
  () =>
    import("@/components/globe/WorldCapitals").then((m) => m.WorldCapitals),
  { ssr: false },
);
const EconomicOverlay = dynamic(
  () =>
    import("@/components/globe/EconomicOverlay").then(
      (m) => m.EconomicOverlay,
    ),
  { ssr: false },
);
const StrategicStraits = dynamic(
  () =>
    import("@/components/globe/StrategicStraits").then(
      (m) => m.StrategicStraits,
    ),
  { ssr: false },
);
const LayerTogglePanel = dynamic(
  () =>
    import("@/components/panels/LayerTogglePanel").then(
      (m) => m.LayerTogglePanel,
    ),
  { ssr: false },
);
const CleanUI = dynamic(
  () => import("@/components/panels/CleanUI").then((m) => m.CleanUI),
  { ssr: false },
);
const TerminalUI = dynamic(
  () => import("@/components/panels/TerminalUI").then((m) => m.TerminalUI),
  { ssr: false },
);

// ── Inner component (needs context) ──────────────────────────────────────────
function SessionMapApp() {
  useWebSocket();

  const { state, dispatch } = useAppContext();
  const { prices, marketMeta, globeMode, terminalMode, tweaks, wsStatus } =
    state;

  const session = useSession();
  const whaleEvents = useWhaleEvents();
  const priceHistory = useSparklines(prices);
  const liveVol = useLiveExchanges(prices["BTC"]?.price ?? 0);
  const { alerts, addAlert, removeAlert, requestNotificationPermission } =
    usePriceAlerts(prices);
  const { quotes: stockQuotes } = useStockTicker();
  const btcQqqCorr = useCorrelation();

  const [hoveredExchangeId, setHoveredExchangeId] = useState<string | null>(
    null,
  );
  const [sunInfo, setSunInfo] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  const [alertsPanelOpen, setAlertsPanelOpen] = useState(false);

  // Terminal-mode body class
  useEffect(() => {
    document.body.classList.toggle("terminal-mode", terminalMode);
  }, [terminalMode]);

  // Sun info for follow mode
  useEffect(() => {
    if (globeMode !== "follow") {
      setSunInfo(null);
      return;
    }
    const update = () =>
      setSunInfo(
        getSunLatLng(new Date(Date.now() + tweaks.timeOffset * 3_600_000)),
      );
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [globeMode, tweaks.timeOffset]);

  // Sync whale events to globe arc spawner
  useEffect(() => {
    const latest = whaleEvents[0];
    if (!latest || typeof window === "undefined") return;
    window.onWhaleArc?.({
      type: latest.type,
      amount: latest.amount,
      from: latest.from,
      to: latest.to,
    });
  }, [whaleEvents]);

  const onGlobeModeChange = (mode: GlobeMode) => {
    dispatch({ type: "SET_GLOBE_MODE", payload: mode });
    window.globeState?.setMode(mode);
  };

  return (
    <>
      <LoadingBar />
      {/* 3D Globe canvas */}
      <GlobeScene mode={globeMode} tweaks={tweaks} />

      {/* React overlay */}
      <div
        id="ui-root"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 10,
          pointerEvents: "none",
        }}
      >
        <ExchangeLabels
          hoveredId={hoveredExchangeId}
          onHover={setHoveredExchangeId}
          liveVol={liveVol}
          globeMode={globeMode}
        />
        <StockMarketLabels />
        <WorldCapitals />
        <EconomicOverlay />
        <StrategicStraits />
        <LayerTogglePanel />

        {/* UI panels above all globe labels (which go up to zIndex 200) */}
        <div style={{ position: "absolute", inset: 0, zIndex: 300, pointerEvents: "none" }}>
        {terminalMode ? (
          <TerminalUI
            session={session}
            prices={prices}
            onToggleTerminal={() => dispatch({ type: "TOGGLE_TERMINAL" })}
            globeMode={globeMode}
            onGlobeModeChange={onGlobeModeChange}
            whaleEvents={whaleEvents}
            fearGreed={marketMeta?.fearGreed ?? null}
            liquidations={state.liquidations}
            fundingRates={state.fundingRates}
            ethGas={state.ethGas}
            priceHistory={priceHistory}
            marketMeta={marketMeta}
            stockQuotes={stockQuotes}
          />
        ) : (
          <CleanUI
            session={session}
            prices={prices}
            onToggleTerminal={() => dispatch({ type: "TOGGLE_TERMINAL" })}
            globeMode={globeMode}
            onGlobeModeChange={onGlobeModeChange}
            sunInfo={sunInfo}
            whaleEvents={whaleEvents}
            wsStatus={wsStatus}
            ethGas={state.ethGas}
            marketMeta={marketMeta}
            onToggleAlerts={() => setAlertsPanelOpen((p) => !p)}
            alertCount={alerts.length}
            btcQqqCorr={btcQqqCorr}
            commodities={state.commodities}
          />
        )}

        {/* Price alerts panel */}
        <PriceAlertsPanel
          open={alertsPanelOpen}
          onClose={() => setAlertsPanelOpen(false)}
          alerts={alerts}
          prices={prices}
          onAdd={addAlert}
          onRemove={removeAlert}
          onRequestPermission={requestNotificationPermission}
        />
        </div>
      </div>

      {/* Tweaks panel — lazy loaded, keyboard shortcut E */}
      <TweaksPanel />
    </>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export default function HomePage() {
  return (
    <AppProvider>
      <SessionMapApp />
    </AppProvider>
  );
}
