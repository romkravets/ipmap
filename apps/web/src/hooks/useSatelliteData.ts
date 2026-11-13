"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { SatOmm, SatelliteGroup } from "@ipmap/types";
import type { SatelliteLayerData } from "@/lib/layers/satellites";
import { fetchSatelliteGroup } from "@/lib/satellites/client";

export interface SatelliteDataState {
  data: SatelliteLayerData;
  loading: SatelliteGroup[];
  errors: Partial<Record<SatelliteGroup, string>>;
}

/**
 * Завантажує кожну увімкнену групу один раз (кеш у ref).
 * Вимкнена група зникає з data, але не перезапитується при повторному вмиканні.
 * Після помилки наступне вмикання пробує знову.
 */
export function useSatelliteData(enabled: SatelliteGroup[]): SatelliteDataState {
  const cache = useRef<Partial<Record<SatelliteGroup, SatOmm[]>>>({});
  const inFlight = useRef<Set<SatelliteGroup>>(new Set());
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState<SatelliteGroup[]>([]);
  const [errors, setErrors] = useState<Partial<Record<SatelliteGroup, string>>>({});

  const key = enabled.join(",");

  useEffect(() => {
    for (const group of enabled) {
      if (cache.current[group] || inFlight.current.has(group)) continue;
      inFlight.current.add(group);
      setLoading((l) => (l.includes(group) ? l : [...l, group]));
      setErrors((e) => {
        if (!(group in e)) return e;
        const { [group]: _drop, ...rest } = e;
        return rest;
      });
      fetchSatelliteGroup(group)
        .then((items) => {
          cache.current[group] = items;
        })
        .catch((err: unknown) => {
          setErrors((e) => ({ ...e, [group]: err instanceof Error ? err.message : "Помилка завантаження" }));
        })
        .finally(() => {
          inFlight.current.delete(group);
          setLoading((l) => l.filter((g) => g !== group));
          setVersion((v) => v + 1);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Стабільне посилання: нове лише при зміні складу груп або завершенні fetch,
  // інакше useGlobe перезавантажує шар супутників на кожен ререндер (hover тощо)
  const data = useMemo<SatelliteLayerData>(() => {
    const out: SatelliteLayerData = {};
    for (const group of key ? (key.split(",") as SatelliteGroup[]) : []) {
      const items = cache.current[group];
      if (items) out[group] = items;
    }
    return out;
  }, [key, version]);
  return { data, loading, errors };
}
