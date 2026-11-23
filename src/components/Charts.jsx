import { useEffect, useId, useRef, useState } from 'react'

function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

function niceMax(v) {
  if (v <= 0) return 1
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10
  return step * p
}

/**
 * Gráfico de columnas de una sola serie con tooltip.
 * data: [{ label, value, sub? }]
 */
export function BarChart({ data, height = 240, format = (v) => v, axisFormat = format, ariaLabel }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const pad = { top: 12, right: 8, bottom: 26, left: 48 }
  const innerW = Math.max(10, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(...data.map((d) => d.value), 0))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const band = innerW / Math.max(1, data.length)
  const barW = Math.max(2, Math.min(36, band * 0.62))
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 54)))
  const y = (v) => pad.top + innerH - (v / max) * innerH

  const barPath = (x, top, w, bottom) => {
    const h = bottom - top
    if (h <= 0.5) return ''
    const r = Math.min(4, w / 2, h)
    return `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}H${x + w - r}Q${x + w},${top} ${x + w},${top + r}V${bottom}Z`
  }

  const hd = hover != null ? data[hover] : null
  const tipLeft = hover != null ? Math.min(Math.max(pad.left + band * hover + band / 2, 70), width - 70) : 0

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart__base' : 'chart__grid'} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="chart__tick">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = pad.left + band * i + (band - barW) / 2
          return (
            <g key={i}>
              {hover === i && <rect x={pad.left + band * i} y={pad.top} width={band} height={innerH} className="chart__hoverband" />}
              <path d={barPath(x, y(d.value), barW, y(0))} className={`chart__bar ${hover != null && hover !== i ? 'is-dim' : ''}`} />
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={height - 8} textAnchor="middle" className="chart__tick">
                  {d.label}
                </text>
              )}
              <rect
                x={pad.left + band * i}
                y={pad.top}
                width={band}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          )
        })}
      </svg>
      {hd && (
        <div className="chart__tip" style={{ left: tipLeft, top: Math.max(0, y(hd.value) - 64) }}>
          <span className="chart__tip-label">{hd.full || hd.label}</span>
          <strong>{format(hd.value)}</strong>
          {hd.sub && <span className="chart__tip-sub">{hd.sub}</span>}
        </div>
      )}
    </div>
  )
}

// Curva monótona (no sobrepasa los datos)
function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : ''
  const n = pts.length
  const dx = [], dy = [], m = [], t = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0]
    dy[i] = pts[i + 1][1] - pts[i][1]
    m[i] = dy[i] / dx[i]
  }
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`
  }
  return d
}

/** Gráfico de área de una sola serie con cursor y tooltip. data: [{ label, value, full?, sub? }] */
export function AreaChart({ data, height = 260, format = (v) => v, axisFormat = format, ariaLabel }) {
  const [ref, width] = useWidth()
  const [hover, setHover] = useState(null)
  const gid = useId().replace(/:/g, '')
  const pad = { top: 16, right: 12, bottom: 28, left: 52 }
  const innerW = Math.max(10, width - pad.left - pad.right)
  const innerH = height - pad.top - pad.bottom
  const max = niceMax(Math.max(...data.map((d) => d.value), 0))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const step = innerW / Math.max(1, data.length - 1)
  const x = (i) => pad.left + (data.length === 1 ? innerW / 2 : i * step)
  const y = (v) => pad.top + innerH - (v / max) * innerH
  const pts = data.map((d, i) => [x(i), y(d.value)])
  const line = smoothPath(pts)
  const area = pts.length ? `${line}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z` : ''
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(innerW / 64)))

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const i = Math.round((e.clientX - r.left - pad.left) / step)
    setHover(Math.max(0, Math.min(data.length - 1, i)))
  }
  const hd = hover != null ? data[hover] : null

  return (
    <div className="chart" ref={ref}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`g${gid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'chart__base' : 'chart__grid'} />
            <text x={pad.left - 10} y={y(t)} dy="0.32em" textAnchor="end" className="chart__tick">{axisFormat(t)}</text>
          </g>
        ))}
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="chart__tick">{d.label}</text>
          ) : null
        )}
        <path d={area} fill={`url(#g${gid})`} />
        <path d={line} className="chart__line" />
        {hd && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={y(0)} className="chart__cursor" />
            <circle cx={x(hover)} cy={y(hd.value)} r="5.5" className="chart__dot" />
          </g>
        )}
      </svg>
      {hd && (
        <div className="chart__tip" style={{ left: Math.min(Math.max(x(hover), 80), width - 80), top: Math.max(0, y(hd.value) - 74) }}>
          <span className="chart__tip-label">{hd.full || hd.label}</span>
          <strong>{format(hd.value)}</strong>
          {hd.sub && <span className="chart__tip-sub">{hd.sub}</span>}
        </div>
      )}
    </div>
  )
}

/** Barras horizontales para comparar magnitudes entre categorías (una sola serie). */
export function HBarList({ data, format = (v) => v, showShare = true }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((a, d) => a + d.value, 0) || 1
  return (
    <ul className="hbars">
      {data.map((d) => (
        <li key={d.label} title={`${d.label}: ${format(d.value)}`}>
          <div className="hbars__row">
            <span className="hbars__label">{d.label}</span>
            <span className="hbars__value">
              {format(d.value)}
              {showShare && <span className="text-muted"> · {Math.round((d.value / total) * 100)}%</span>}
            </span>
          </div>
          <div className="hbars__track">
            <span style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

export function GoalRing({ value, goal, size = 68, stroke = 7 }) {
  const pct = goal > 0 ? value / goal : 0
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const shown = Math.min(1, Math.max(0, pct))
  return (
    <div className={`goal-ring ${pct >= 1 ? 'is-done' : ''}`} style={{ width: size, height: size }} role="img" aria-label={`${Math.round(pct * 100)}% de la meta`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} className="goal-ring__track" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          className="goal-ring__bar"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="goal-ring__label">{Math.round(pct * 100)}%</span>
    </div>
  )
}
