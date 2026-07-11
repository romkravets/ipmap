'use client';
import { useState, useEffect } from 'react';
import type { SubmarineCable, DataCenter, IxPoint } from '@ipmap/types';

export function useInfraData() {
  const [cables, setCables] = useState<SubmarineCable[]>([]);
  const [dataCenters, setDataCenters] = useState<DataCenter[]>([]);
  const [ixps, setIxps] = useState<IxPoint[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/data/submarine-cables.json').then(r => r.json()).catch(() => []),
      fetch('/data/datacenters.json').then(r => r.json()).catch(() => []),
      fetch('/data/ixps.json').then(r => r.json()).catch(() => []),
    ]).then(([c, d, i]) => {
      setCables(c);
      setDataCenters(d);
      setIxps(i);
    });
  }, []);

  return { cables, dataCenters, ixps };
}
