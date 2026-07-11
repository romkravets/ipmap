'use client'

import type { CountryAlloc } from '@ipmap/types'

function formatIPs(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} млрд`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)} млн`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)} тис`
  return String(n)
}

interface CountryPanelProps {
  country: CountryAlloc
  blockCount: number
  onBack: () => void
}

export function CountryPanel({ country, blockCount, onBack }: CountryPanelProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: 16,
        zIndex: 50,
        background: 'rgba(0,0,0,0.75)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '12px 16px',
        color: '#fff',
        fontFamily: 'monospace',
        minWidth: 240,
        pointerEvents: 'all',
      }}
    >
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: '#60a5fa',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 8,
          fontSize: 13,
        }}
      >
        ← Назад до світу
      </button>
      <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        {country.name} ({country.cc})
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>
        IPv4-адрес: <span style={{ color: '#f8fafc' }}>{formatIPs(country.ipCount)}</span>
      </div>
      <div style={{ fontSize: 13, color: '#94a3b8' }}>
        Блоків: <span style={{ color: '#f8fafc' }}>{blockCount.toLocaleString()}</span>
      </div>
      <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
        Клікніть по блоку для RDAP інфо
      </div>
    </div>
  )
}
