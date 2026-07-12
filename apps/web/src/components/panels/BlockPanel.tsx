'use client'

import { useState, useEffect, useRef } from 'react'
import type { IpBlock } from '@ipmap/types'
import { fetchRdap, type RdapInfo } from '@/lib/rdap'
import { useClickOutside } from '@/hooks/useClickOutside'

interface BlockPanelProps {
  block: IpBlock
  onClose: () => void
}

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

function formatSize(size: number): string {
  if (!isPowerOfTwo(size)) return `(${size.toLocaleString()} адрес)`
  const prefix = 32 - Math.log2(size)
  if (size >= 1_000_000) return `/${prefix} (${(size / 1e6).toFixed(1)}M адрес)`
  if (size >= 1024) return `/${prefix} (${(size / 1024).toFixed(0)}K адрес)`
  return `/${prefix} (${size} адрес)`
}

export function BlockPanel({ block, onClose }: BlockPanelProps) {
  const [info, setInfo] = useState<RdapInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  useClickOutside(panelRef, onClose)

  useEffect(() => {
    setLoading(true)
    setInfo(null)
    fetchRdap(block.start).then(data => {
      setInfo(data)
      setLoading(false)
    })
  }, [block.start])

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        zIndex: 50,
        background: 'rgba(0,0,0,0.8)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        padding: '12px 16px',
        color: '#fff',
        fontFamily: 'monospace',
        minWidth: 280,
        maxWidth: 360,
        pointerEvents: 'all',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#60a5fa' }}>
          {block.start} {formatSize(block.size)}
        </span>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 16 }}
        >
          ×
        </button>
      </div>

      {loading && <div style={{ color: '#64748b', fontSize: 13 }}>Завантаження RDAP...</div>}

      {!loading && !info && (
        <div style={{ color: '#ef4444', fontSize: 13 }}>RDAP недоступний для цього блоку</div>
      )}

      {!loading && info && (
        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
          <div>
            <span style={{ color: '#64748b' }}>Назва: </span>
            <span>{info.name || '—'}</span>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Організація: </span>
            <span>{info.orgName || '—'}</span>
          </div>
          {info.abuseEmail && (
            <div>
              <span style={{ color: '#64748b' }}>Abuse: </span>
              <a
                href={`mailto:${info.abuseEmail}`}
                style={{ color: '#60a5fa' }}
              >
                {info.abuseEmail}
              </a>
            </div>
          )}
          {info.registrationDate && (
            <div>
              <span style={{ color: '#64748b' }}>Виділено: </span>
              <span>{info.registrationDate.slice(0, 10)}</span>
            </div>
          )}
          <div>
            <span style={{ color: '#64748b' }}>Діапазон: </span>
            <span style={{ fontSize: 11 }}>{info.startAddress} – {info.endAddress}</span>
          </div>
        </div>
      )}
    </div>
  )
}
