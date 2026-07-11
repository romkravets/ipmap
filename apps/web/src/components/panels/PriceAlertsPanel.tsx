'use client'

import { useState, memo } from 'react'
import type { PriceAlert } from '@/hooks/usePriceAlerts'
import type { PriceSnapshot } from '@sessionmap/types'

const SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP']

interface PriceAlertsPanelProps {
  open: boolean
  onClose: () => void
  alerts: PriceAlert[]
  prices: PriceSnapshot
  onAdd: (symbol: string, direction: 'above' | 'below', threshold: number) => void
  onRemove: (id: string) => void
  onRequestPermission: () => void
}

export const PriceAlertsPanel = memo(function PriceAlertsPanel({
  open,
  onClose,
  alerts,
  prices,
  onAdd,
  onRemove,
  onRequestPermission,
}: PriceAlertsPanelProps) {
  const [symbol, setSymbol] = useState('BTC')
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [thresholdStr, setThresholdStr] = useState('')

  if (!open) return null

  function handleAdd() {
    const threshold = parseFloat(thresholdStr)
    if (isNaN(threshold) || threshold <= 0) return
    onAdd(symbol, direction, threshold)
    setThresholdStr('')
  }

  const panelStyle: React.CSSProperties = {
    position: 'absolute',
    top: '60px',
    right: '28px',
    width: '280px',
    background: 'rgba(8,11,20,0.97)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '12px',
    padding: '14px 16px',
    zIndex: 50,
    pointerEvents: 'all',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: '9px', color: 'var(--fg-muted)',
    fontFamily: 'var(--font-mono, monospace)',
    letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px',
  }
  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: '6px', padding: '5px 10px',
    color: 'var(--fg)', fontSize: '12px',
    fontFamily: 'var(--font-mono, monospace)',
    width: '100%', outline: 'none',
    boxSizing: 'border-box',
  }
  const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }
  const btnStyle: React.CSSProperties = {
    background: 'rgba(125,211,252,0.12)',
    border: '1px solid var(--accent)',
    borderRadius: '6px', padding: '5px 14px',
    color: 'var(--accent)', fontSize: '11px',
    fontFamily: 'var(--font-mono, monospace)',
    cursor: 'pointer', letterSpacing: '0.06em',
  }

  return (
    <div style={panelStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '11px', color: 'var(--fg)', fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.08em' }}>
          PRICE ALERTS
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', fontSize: '14px' }}>
          ×
        </button>
      </div>

      {typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && (
        <button onClick={onRequestPermission} style={{ ...btnStyle, width: '100%', marginBottom: '10px' }}>
          Enable Notifications
        </button>
      )}

      {/* Add alert form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
        <div>
          <div style={labelStyle}>Symbol</div>
          <select value={symbol} onChange={e => setSymbol(e.target.value)} style={selectStyle}>
            {SYMBOLS.map(s => (
              <option key={s} value={s}>{s} — ${(prices[s]?.price ?? 0).toLocaleString()}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <div style={labelStyle}>Direction</div>
            <select value={direction} onChange={e => setDirection(e.target.value as 'above' | 'below')} style={selectStyle}>
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          <div>
            <div style={labelStyle}>Price ($)</div>
            <input
              type="number"
              value={thresholdStr}
              onChange={e => setThresholdStr(e.target.value)}
              placeholder="0"
              style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />
          </div>
        </div>
        <button onClick={handleAdd} style={btnStyle}>+ Add Alert</button>
      </div>

      {/* Existing alerts */}
      {alerts.length === 0 ? (
        <div style={{ fontSize: '10px', color: 'var(--fg-dim)', fontFamily: 'var(--font-mono, monospace)' }}>
          No alerts set
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {alerts.map(alert => {
            const current = prices[alert.symbol]?.price ?? 0
            const triggered = alert.direction === 'above' ? current >= alert.threshold : current <= alert.threshold
            return (
              <div key={alert.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '5px 8px', borderRadius: '5px',
                background: triggered ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${triggered ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: 'var(--accent)', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                    {alert.symbol}
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--fg-muted)', fontFamily: 'var(--font-mono, monospace)' }}>
                    {alert.direction} ${alert.threshold.toLocaleString()}
                  </span>
                  {triggered && (
                    <span style={{ fontSize: '8px', color: 'var(--danger)', fontFamily: 'var(--font-mono, monospace)', fontWeight: 600 }}>
                      ●
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onRemove(alert.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--fg-dim)', cursor: 'pointer', fontSize: '12px', padding: '0 2px' }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
