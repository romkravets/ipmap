import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLayerControls } from "../useLayers";

type W = Window & {
  globeLayers?: Record<string, boolean>;
  globeLayerGroups?: Record<string, { visible: boolean }>;
};
const w = window as unknown as W;

describe("useLayerControls toggle", () => {
  it('toggle("satellites") вимикає групу з window.globeLayerGroups', () => {
    w.globeLayerGroups = { satellites: { visible: true }, cables: { visible: true } };
    w.globeLayers = undefined;
    const { result } = renderHook(() => useLayerControls());
    act(() => result.current[1]("satellites"));
    expect(w.globeLayerGroups!.satellites.visible).toBe(false);
    expect(w.globeLayerGroups!.cables.visible).toBe(true);
  });

  it("існуючі ключі (cables/borders/datacenters/ixps) працюють як раніше", () => {
    w.globeLayerGroups = {
      cables: { visible: true },
      borders: { visible: false },
      datacenters: { visible: true },
      ixps: { visible: true },
    };
    w.globeLayers = undefined;
    const { result } = renderHook(() => useLayerControls());
    act(() => result.current[1]("cables"));
    expect(w.globeLayerGroups!.cables.visible).toBe(false);
    act(() => result.current[1]("borders"));
    expect(w.globeLayerGroups!.borders.visible).toBe(true);
    act(() => result.current[1]("datacenters"));
    expect(w.globeLayerGroups!.datacenters.visible).toBe(false);
    act(() => result.current[1]("ixps"));
    expect(w.globeLayerGroups!.ixps.visible).toBe(false);
  });

  it("ключ без групи не кидає помилку", () => {
    w.globeLayerGroups = {};
    w.globeLayers = undefined;
    const { result } = renderHook(() => useLayerControls());
    expect(() => act(() => result.current[1]("satellites"))).not.toThrow();
  });
});
