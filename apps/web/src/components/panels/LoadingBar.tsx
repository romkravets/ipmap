"use client";

import { useState, useEffect } from "react";

export function LoadingBar() {
  const [pct, setPct] = useState(8);
  const [done, setDone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const p = (e as CustomEvent<{ pct: number }>).detail.pct;
      setPct(p);
      if (p >= 100) {
        setTimeout(() => setDone(true), 300);
        setTimeout(() => setHidden(true), 800);
      }
    };
    window.addEventListener("globe-load-progress", handler);
    return () => window.removeEventListener("globe-load-progress", handler);
  }, []);

  if (hidden) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "2px",
        zIndex: 9999,
        pointerEvents: "none",
        opacity: done ? 0 : 1,
        transition: done ? "opacity 0.5s ease" : "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, #0ea5e9, #22d3ee)",
          boxShadow: "0 0 8px #22d3ee88",
          transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          borderRadius: "0 2px 2px 0",
        }}
      />
    </div>
  );
}
