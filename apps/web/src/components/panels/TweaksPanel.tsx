'use client'

import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react'
import type { TweakValues, GlobeMode } from '@sessionmap/types'
import { useAppContext } from '@/contexts/AppContext'

const CSS = `
.twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
  max-height:calc(100vh - 32px);display:flex;flex-direction:column;
  background:rgba(10,14,26,.94);color:#E8ECF4;
  -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
  border:.5px solid rgba(125,211,252,.18);border-radius:14px;
  box-shadow:0 12px 40px rgba(0,0,0,.5);
  font:11.5px/1.4 'Inter',ui-sans-serif,system-ui,sans-serif;overflow:hidden}
.twk-hd{display:flex;align-items:center;justify-content:space-between;
  padding:10px 8px 10px 14px;cursor:move;user-select:none;
  border-bottom:.5px solid rgba(255,255,255,.06)}
.twk-hd b{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
  color:rgba(125,211,252,.8)}
.twk-x{appearance:none;border:0;background:transparent;color:rgba(232,236,244,.4);
  width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:13px;line-height:22px}
.twk-x:hover{background:rgba(255,255,255,.06);color:#E8ECF4}
.twk-body{padding:8px 14px 14px;display:flex;flex-direction:column;gap:10px;
  overflow-y:auto;overflow-x:hidden;min-height:0;
  scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent}
.twk-sect{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;
  color:rgba(125,211,252,.45);padding:8px 0 0;border-top:.5px solid rgba(255,255,255,.05)}
.twk-sect:first-child{padding-top:0;border-top:none}
.twk-row{display:flex;flex-direction:column;gap:5px}
.twk-row-h{flex-direction:row;align-items:center;justify-content:space-between}
.twk-lbl{display:flex;justify-content:space-between;align-items:baseline;color:rgba(232,236,244,.6)}
.twk-lbl>span:first-child{font-weight:500;font-size:11px}
.twk-val{color:rgba(125,211,252,.7);font-variant-numeric:tabular-nums;font-family:'JetBrains Mono',monospace}
.twk-slider{appearance:none;-webkit-appearance:none;width:100%;height:3px;margin:6px 0;
  border-radius:999px;background:rgba(255,255,255,.1);outline:none}
.twk-slider::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#7DD3FC;cursor:pointer}
.twk-slider::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#7DD3FC;border:none;cursor:pointer}
.twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
  background:rgba(255,255,255,.12);transition:background .15s;cursor:pointer;padding:0;flex-shrink:0}
.twk-toggle[data-on="1"]{background:#7DD3FC}
.twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
  background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:transform .15s;display:block;pointer-events:none}
.twk-toggle[data-on="1"] i{transform:translateX(14px)}
.twk-btn-nav{appearance:none;width:100%;height:30px;padding:0 10px;
  border:1px solid rgba(255,255,255,.1);border-radius:6px;background:transparent;
  color:rgba(232,236,244,.6);font:inherit;font-size:11px;font-family:'JetBrains Mono',monospace;
  cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;transition:all .15s}
.twk-btn-nav:hover{background:rgba(255,255,255,.04);color:#E8ECF4}
.twk-btn-nav.active{background:rgba(125,211,252,.1);border-color:rgba(125,211,252,.4);color:#7DD3FC}
`

export function TweaksPanel() {
  const { state, dispatch } = useAppContext()
  const { tweaks, globeMode } = state
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef({ x: 16, y: 16 })

  const clamp = useCallback(() => {
    const panel = panelRef.current
    if (!panel) return
    const w = panel.offsetWidth, h = panel.offsetHeight
    const PAD = 16
    offsetRef.current = {
      x: Math.min(Math.max(PAD, offsetRef.current.x), window.innerWidth - w - PAD),
      y: Math.min(Math.max(PAD, offsetRef.current.y), window.innerHeight - h - PAD),
    }
    panel.style.right = offsetRef.current.x + 'px'
    panel.style.bottom = offsetRef.current.y + 'px'
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && !(e.target instanceof HTMLInputElement)) {
        setOpen(m => !m)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) clamp()
  }, [open, clamp])

  const startDrag = (e: React.MouseEvent) => {
    const panel = panelRef.current
    if (!panel) return
    const r = panel.getBoundingClientRect()
    const sx = e.clientX, sy = e.clientY
    const startR = window.innerWidth - r.right
    const startB = window.innerHeight - r.bottom
    const move = (ev: MouseEvent) => {
      offsetRef.current = { x: startR - (ev.clientX - sx), y: startB - (ev.clientY - sy) }
      clamp()
    }
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  function setTweak<K extends keyof TweakValues>(key: K, val: TweakValues[K]) {
    dispatch({ type: 'SET_TWEAK', payload: { [key]: val } })
  }

  if (!open) return null

  const MODES: GlobeMode[] = ['auto', 'free', 'follow']

  return (
    <>
      <style>{CSS}</style>
      <div ref={panelRef} className="twk-panel" style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}>
        <div className="twk-hd" onMouseDown={startDrag}>
          <b>Tweaks</b>
          <button className="twk-x" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="twk-body">

          <div className="twk-sect">Globe Mode</div>
          {MODES.map(m => (
            <button key={m} className={`twk-btn-nav${globeMode === m ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_GLOBE_MODE', payload: m })}>
              <span>{m.charAt(0).toUpperCase() + m.slice(1)}</span>
              {globeMode === m && <span>✓</span>}
            </button>
          ))}

          <div className="twk-sect">Rotation</div>
          <div className="twk-row">
            <div className="twk-lbl">
              <span>Speed</span>
              <span className="twk-val">{tweaks.rotationSpeed}</span>
            </div>
            <input type="range" className="twk-slider" min={0} max={100} step={1}
              value={tweaks.rotationSpeed} onChange={e => setTweak('rotationSpeed', Number(e.target.value))} />
          </div>

          <div className="twk-sect">Time Offset</div>
          <div className="twk-row">
            <div className="twk-lbl">
              <span>Hours (UTC±)</span>
              <span className="twk-val">{tweaks.timeOffset >= 0 ? '+' : ''}{tweaks.timeOffset}h</span>
            </div>
            <input type="range" className="twk-slider" min={-12} max={14} step={1}
              value={tweaks.timeOffset} onChange={e => setTweak('timeOffset', Number(e.target.value))} />
          </div>

          <div className="twk-sect">Visibility</div>
          {([
            ['showTerminator', 'Day/Night Line'],
            ['showSunMarker',  'Sun Marker'],
            ['markerPulse',    'Exchange Pulse'],
          ] as [keyof TweakValues, string][]).map(([key, label]) => (
            <div key={key} className="twk-row twk-row-h">
              <label style={{ fontSize: '11px', color: 'rgba(232,236,244,.6)', fontWeight: 500 }}>{label}</label>
              <button className="twk-toggle" data-on={tweaks[key] ? '1' : '0'} role="switch"
                onClick={() => setTweak(key, !tweaks[key] as TweakValues[typeof key])}>
                <i />
              </button>
            </div>
          ))}

          <div className="twk-sect">Shortcuts</div>
          <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(107,116,137,1)', lineHeight: 2 }}>
            <div><span style={{ color: '#7DD3FC' }}>E</span> open/close tweaks</div>
            <div><span style={{ color: '#7DD3FC' }}>scroll</span> zoom globe</div>
            <div><span style={{ color: '#7DD3FC' }}>drag</span> rotate</div>
          </div>

        </div>
      </div>
    </>
  )
}
