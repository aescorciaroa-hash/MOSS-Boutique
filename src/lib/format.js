const cop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('es-CO')

export const money = (v) => cop.format(Math.round(v || 0))
export const number = (v) => num.format(v || 0)
export const pct = (v, digits = 1) => `${(v * 100).toFixed(digits).replace('.', ',')}%`
export const compactMoney = (v) => {
  const a = Math.abs(v)
  if (a >= 1e6) return `$${(v / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',')}M`
  if (a >= 1e3) return `$${Math.round(v / 1e3)}K`
  return `$${Math.round(v)}`
}

export const fmtDate = (d, opts = { day: '2-digit', month: 'short', year: 'numeric' }) =>
  new Date(d).toLocaleDateString('es-CO', opts)
export const fmtTime = (d) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
export const fmtDateTime = (d) => `${fmtDate(d)} · ${fmtTime(d)}`

export const startOfDay = (d = new Date()) => {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}
export const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export const dayKey = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export const toInputDate = dayKey

export const uid = (prefix = '') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const normalize = (s = '') =>
  s
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')

export function downloadCSV(filename, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n')
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Rango de fechas por preset */
export function rangeFor(preset, custom) {
  const today = startOfDay()
  switch (preset) {
    case 'today':
      return [today, addDays(today, 1)]
    case 'yesterday':
      return [addDays(today, -1), today]
    case '7d':
      return [addDays(today, -6), addDays(today, 1)]
    case '30d':
      return [addDays(today, -29), addDays(today, 1)]
    case 'month':
      return [new Date(today.getFullYear(), today.getMonth(), 1), addDays(today, 1)]
    case 'custom':
      return [startOfDay(custom?.from || today), addDays(startOfDay(custom?.to || today), 1)]
    default:
      return [new Date(0), addDays(today, 1)]
  }
}

export const PRESETS = [
  ['today', 'Hoy'],
  ['7d', '7 días'],
  ['30d', '30 días'],
  ['month', 'Este mes'],
  ['all', 'Todo'],
]
