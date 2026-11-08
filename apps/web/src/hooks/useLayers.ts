"use client";

import { useState, useEffect } from "react";

export type LayerKey = "cities" | "resources" | "straits" | "cables" | "borders" | "seasons" | "datacenters" | "ixps" | "satellites";

const LAYER_DEFAULTS: Record<LayerKey, boolean> = {
  cities:      true,
  resources:   true,
  straits:     true,
  cables:      true,
  borders:     false,
  seasons:     true,
  datacenters: true,
  ixps:        true,
  satellites:  true,
};

// Read from window or return default
function getLayerState(): Record<LayerKey, boolean> {
  if (typeof window === "undefined") return { ...LAYER_DEFAULTS };
  // Мерж з дефолтами: старий стан без нових ключів (напр. satellites) не дає undefined
  const stored = (window as Window & { globeLayers?: Partial<Record<LayerKey, boolean>> }).globeLayers;
  return { ...LAYER_DEFAULTS, ...stored };
}

/** Hook for a single layer's visibility. Reacts to globe-layers-changed events. */
export function useLayer(key: LayerKey): boolean {
  const [visible, setVisible] = useState(() => LAYER_DEFAULTS[key]);

  useEffect(() => {
    setVisible(getLayerState()[key]);

    const handler = () => setVisible(getLayerState()[key]);
    window.addEventListener("globe-layers-changed", handler);
    return () => window.removeEventListener("globe-layers-changed", handler);
  }, [key]);

  return visible;
}

/** Hook for managing all layers — used by the toggle panel. */
export function useLayerControls(): [Record<LayerKey, boolean>, (key: LayerKey) => void] {
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({ ...LAYER_DEFAULTS });

  useEffect(() => {
    const current = getLayerState();
    setLayers({ ...current });

    const handler = () => setLayers({ ...getLayerState() });
    window.addEventListener("globe-layers-changed", handler);
    return () => window.removeEventListener("globe-layers-changed", handler);
  }, []);

  const toggle = (key: LayerKey) => {
    const next = { ...getLayerState(), [key]: !getLayerState()[key] };
    (window as Window & { globeLayers?: Record<LayerKey, boolean> }).globeLayers = next;

    // Update Three.js groups if exposed
    // Загальний toggle: ключі без групи мовчки пропускаються
    const groups = (window as Window & { globeLayerGroups?: Partial<Record<string, { visible: boolean }>> }).globeLayerGroups;
    const group = groups?.[key];
    if (group) group.visible = next[key];

    window.dispatchEvent(new CustomEvent("globe-layers-changed"));
  };

  return [layers, toggle];
}
