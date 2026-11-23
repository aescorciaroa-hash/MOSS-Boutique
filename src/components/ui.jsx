import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Info, X, XCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'

// ---------------- Tabla de datos: paginación ----------------
// Divide una lista en páginas para no tener que bajar tanto. En celular empieza con 10 filas.
const PAGE_SIZES = [10, 25, 50]
export function usePaged(list, initial) {
  const [size, setSize] = useState(() => initial || (typeof window !== 'undefined' && window.innerWidth < 761 ? 10 : 25))
  const [page, setPage] = useState(1)
  const total = list.length
  const pages = Math.max(1, Math.ceil(total / size))
  // Al cambiar los filtros (cambian los elementos de la lista) se vuelve a la primera página.
  const signature = list.map((x, i) => x?.id ?? i).join('|')
  useEffect(() => setPage(1), [signature, size])
  const current = Math.min(page, pages)
  return { rows: list.slice((current - 1) * size, current * size), page: current, pages, size, setSize, setPage, total }
}

export function Pager({ pg, noun = 'registros' }) {
  if (!pg.total) return null
  const from = (pg.page - 1) * pg.size + 1
  const to = Math.min(pg.page * pg.size, pg.total)
  // Números de página visibles: primera, última y las vecinas de la actual.
  const nums = [...new Set([1, pg.page - 1, pg.page, pg.page + 1, pg.pages])].filter((n) => n >= 1 && n <= pg.pages).sort((a, b) => a - b)
  const go = (n) => { pg.setPage(n); requestAnimationFrame(() => document.activeElement?.closest('.card')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })) }
  return (
    <div className="pager pager--data">
      <span className="pager__info"><b>{from}–{to}</b> de <b>{pg.total}</b> {noun}</span>
      <div className="pager__size">
        <span>Filas</span>
        <Select className="input input--sm" value={pg.size} onChange={(e) => pg.setSize(Number(e.target.value))} aria-label="Filas por página">
          {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
      </div>
      {pg.pages > 1 && (
        <div className="pager__pages">
          <button type="button" className="pager__btn" disabled={pg.page === 1} onClick={() => go(pg.page - 1)} aria-label="Página anterior"><ChevronLeft size={16} /></button>
          {nums.map((n, i) => (
            <span key={n} className="pager__group">
              {i > 0 && n - nums[i - 1] > 1 && <span className="pager__dots">…</span>}
              <button type="button" className={`pager__btn ${n === pg.page ? 'is-active' : ''}`} onClick={() => go(n)}>{n}</button>
            </span>
          ))}
          <button type="button" className="pager__btn" disabled={pg.page === pg.pages} onClick={() => go(pg.page + 1)} aria-label="Página siguiente"><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  )
}

// ---------------- Campo de dinero ----------------
// Muestra el monto con puntos de miles mientras se escribe (500.000) y entrega el número limpio.
// onChange recibe { target: { value } } como un input normal, con value numérico o '' si está vacío.
const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
export function MoneyInput({ value, onChange, className = 'input', placeholder = '0', ...rest }) {
  const ref = useRef(null)
  const caret = useRef(null)
  const digits = value === '' || value == null || Number.isNaN(Number(value)) ? '' : String(Math.max(0, Math.round(Number(value))))
  const shown = groupThousands(digits)
  // Mantiene el cursor en el mismo dígito después de agregar o quitar puntos.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || caret.current == null || document.activeElement !== el) return
    let seen = 0, pos = 0
    while (pos < shown.length && seen < caret.current) { if (/\d/.test(shown[pos])) seen++; pos++ }
    el.setSelectionRange(pos, pos)
    caret.current = null
  })
  const handle = (e) => {
    const raw = e.target.value
    let before = raw.slice(0, e.target.selectionStart ?? raw.length).replace(/\D/g, '').length
    let clean = raw.replace(/\D/g, '')
    // Si se borró solo un punto, se borra el dígito anterior (como en las apps bancarias).
    if (clean === digits && raw.length < shown.length && before > 0) {
      clean = clean.slice(0, before - 1) + clean.slice(before)
      before -= 1
    }
    const trimmed = clean.replace(/^0+(?=\d)/, '').slice(0, 13)
    caret.current = Math.max(0, before - (clean.length - clean.replace(/^0+(?=\d)/, '').length))
    if (trimmed === digits) { e.target.value = shown; return }
    onChange?.({ target: { value: trimmed === '' ? '' : Number(trimmed) } })
  }
  return (
    <div className="input-money">
      <span className="input-money__sign">$</span>
      <input ref={ref} {...rest} className={className} type="text" inputMode="numeric" autoComplete="off" value={shown} onChange={handle} placeholder={placeholder} />
    </div>
  )
}

// ---------------- Calendario moderno ----------------
// Reemplaza al <input type="date"> nativo. value y onChange usan 'AAAA-MM-DD' como el nativo.
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const WEEK = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
const pad2 = (n) => String(n).padStart(2, '0')
const toISO = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const fromISO = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null
}
export function DateInput({ value, onChange, min, max, className = '', placeholder = 'Elegir fecha', 'aria-label': ariaLabel }) {
  const selected = fromISO(value)
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(() => selected || new Date())
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const pop = useRef(null)
  const todayISO = toISO(new Date())

  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const w = 300, h = 360
    const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8))
    const below = window.innerHeight - r.bottom
    setPos(below < h + 12 && r.top > below ? { left, bottom: window.innerHeight - r.top + 8 } : { left, top: r.bottom + 8 })
  }
  useLayoutEffect(() => {
    if (!open) return
    setView(selected || new Date())
    const r = btn.current?.getBoundingClientRect()
    if (r && window.innerHeight - r.bottom < 372) btn.current.scrollIntoView({ block: 'center' })
    place()
  }, [open])
  useEffect(() => {
    if (!open) return
    const out = (e) => { if (!btn.current?.contains(e.target) && !pop.current?.contains(e.target)) setOpen(false) }
    const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false) } }
    const move = (e) => { if (!pop.current?.contains(e.target)) place() }
    document.addEventListener('mousedown', out)
    window.addEventListener('keydown', key, true)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', move, true)
    return () => { document.removeEventListener('mousedown', out); window.removeEventListener('keydown', key, true); window.removeEventListener('resize', place); window.removeEventListener('scroll', move, true) }
  }, [open])

  const y = view.getFullYear(), mo = view.getMonth()
  const first = new Date(y, mo, 1)
  const offset = (first.getDay() + 6) % 7 // semana empieza el lunes
  const cells = Array.from({ length: 42 }, (_, i) => new Date(y, mo, 1 - offset + i))
  const disabled = (iso) => (min && iso < min) || (max && iso > max)
  const pick = (d) => {
    const iso = toISO(d)
    if (disabled(iso)) return
    onChange?.({ target: { value: iso } })
    setOpen(false)
    btn.current?.focus()
  }
  const shown = selected ? `${selected.getDate()} ${MONTHS[selected.getMonth()].slice(0, 3)} ${selected.getFullYear()}` : placeholder

  return (
    <>
      <button ref={btn} type="button" className={`select date-input ${className} ${open ? 'is-open' : ''}`} onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel}>
        <CalendarDays size={16} className="date-input__icon" />
        <span className="select__value">{shown}</span>
        <ChevronDown size={16} className="select__chev" />
      </button>
      {open && pos && createPortal(
        <div ref={pop} className="calendar" style={pos} role="dialog" aria-label="Calendario" onMouseDown={(e) => e.stopPropagation()}>
          <div className="calendar__head">
            <button type="button" className="calendar__nav" onClick={() => setView(new Date(y, mo - 1, 1))} aria-label="Mes anterior"><ChevronLeft size={18} /></button>
            <strong>{MONTHS[mo]} <span>{y}</span></strong>
            <button type="button" className="calendar__nav" onClick={() => setView(new Date(y, mo + 1, 1))} aria-label="Mes siguiente"><ChevronRight size={18} /></button>
          </div>
          <div className="calendar__week">{WEEK.map((d, i) => <span key={i}>{d}</span>)}</div>
          <div className="calendar__grid">
            {cells.map((d) => {
              const iso = toISO(d)
              const cls = [
                'calendar__day',
                d.getMonth() !== mo && 'is-out',
                iso === todayISO && 'is-today',
                iso === value && 'is-selected',
                disabled(iso) && 'is-disabled',
              ].filter(Boolean).join(' ')
              return <button key={iso} type="button" className={cls} disabled={!!disabled(iso)} onClick={() => pick(d)}>{d.getDate()}</button>
            })}
          </div>
          <div className="calendar__foot">
            <button type="button" className="btn btn--secondary btn--sm" disabled={!!disabled(todayISO)} onClick={() => pick(new Date())}>Hoy</button>
            <button type="button" className="btn btn--sm calendar__close" onClick={() => setOpen(false)}>Cerrar</button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ---------------- Select moderno ----------------
// Reemplaza al <select> nativo (cuya lista no se puede estilizar). Acepta los mismos
// hijos <option> y llama a onChange({ target: { value } }) como el nativo.
const textOf = (node) => {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf(node.props.children)
  return ''
}
const optionsOf = (children) => {
  const out = []
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return
    if (c.type === 'option') {
      const label = textOf(c.props.children)
      out.push({ value: c.props.value !== undefined ? String(c.props.value) : label, label, disabled: !!c.props.disabled })
    } else if (c.props?.children) out.push(...optionsOf(c.props.children))
  })
  return out
}

export function Select({ value, onChange, children, className = '', disabled, 'aria-label': ariaLabel }) {
  const opts = optionsOf(children)
  const current = opts.find((o) => o.value === String(value ?? '')) || opts[0]
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const list = useRef(null)
  const id = useId()

  const want = Math.min(300, opts.length * 46 + 14)
  // La lista siempre se abre hacia abajo. Si no cabe, primero se desplaza la página
  // (o el modal) para dejarle espacio; solo se abre hacia arriba si aun así no cabe.
  const place = () => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom - 14
    const up = below < 150 && r.top > below
    const minWidth = Math.min(Math.max(r.width, 200), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left, window.innerWidth - minWidth - 8))
    setPos({
      left, minWidth, maxWidth: window.innerWidth - left - 8,
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      maxHeight: Math.min(want, Math.max(150, (up ? r.top - 14 : below))),
    })
  }
  useLayoutEffect(() => {
    if (!open) return
    const r = btn.current?.getBoundingClientRect()
    if (r && window.innerHeight - r.bottom - 14 < want) {
      btn.current.scrollIntoView({ block: 'center' })
      const r2 = btn.current.getBoundingClientRect()
      if (window.innerHeight - r2.bottom - 14 < want) window.scrollBy(0, Math.min(r2.top - 90, want - (window.innerHeight - r2.bottom - 14)))
    }
    place()
  }, [open])
  useEffect(() => {
    if (!open) return
    const out = (e) => { if (!btn.current?.contains(e.target) && !list.current?.contains(e.target)) setOpen(false) }
    const move = (e) => { if (!list.current?.contains(e.target)) place() }
    document.addEventListener('mousedown', out)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', move, true)
    return () => { document.removeEventListener('mousedown', out); window.removeEventListener('resize', place); window.removeEventListener('scroll', move, true) }
  }, [open])
  useEffect(() => {
    if (open) list.current?.querySelector('.select__opt.is-hi')?.scrollIntoView({ block: 'nearest' })
  }, [open, hi])

  const choose = (o) => {
    if (o.disabled) return
    setOpen(false)
    btn.current?.focus()
    if (o.value !== current?.value) onChange?.({ target: { value: o.value } })
  }
  const openList = () => { setHi(Math.max(0, opts.indexOf(current))); setOpen(true) }
  const onKey = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) return openList()
      setHi((h) => (h + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (open) choose(opts[hi]); else openList()
    } else if (e.key === 'Escape' && open) {
      e.stopPropagation(); setOpen(false)
    } else if (e.key === 'Tab') setOpen(false)
  }

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`select ${className} ${open ? 'is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKey}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={ariaLabel}
      >
        <span className="select__value">{current?.label}</span>
        <ChevronDown size={16} className="select__chev" />
      </button>
      {open && pos && createPortal(
        <ul ref={list} id={id} role="listbox" className="select__list" style={pos} onMouseDown={(e) => e.stopPropagation()}>
          {opts.map((o, i) => (
            <li
              key={`${o.value}-${i}`}
              role="option"
              aria-selected={o.value === current?.value}
              className={`select__opt ${o.value === current?.value ? 'is-selected' : ''} ${i === hi ? 'is-hi' : ''} ${o.disabled ? 'is-disabled' : ''}`}
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(o)}
            >
              <span>{o.label}</span>
              {o.value === current?.value && <Check size={15} strokeWidth={2.6} />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  )
}

function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}

function DialogHead({ icon: Icon, tone = 'accent', title, subtitle, badge, onClose }) {
  return (
    <header className="modal__head">
      {Icon && <span className={`modal__icon modal__icon--${tone}`}><Icon size={22} /></span>}
      <div className="modal__titles">
        <div className="modal__title-row">
          <h2>{title}</h2>
          {badge && <span className="modal__badge">{badge}</span>}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <button className="btn-icon modal__close" onClick={onClose} aria-label="Cerrar">
        <X size={18} />
      </button>
    </header>
  )
}

export function Modal({ title, subtitle, onClose, children, footer, size = 'md', icon, tone, badge }) {
  useEscape(onClose)
  return createPortal(
    <div className="backdrop" onMouseDown={onClose}>
      <div className={`modal modal--${size}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {title && <DialogHead icon={icon} tone={tone} title={title} subtitle={subtitle} badge={badge} onClose={onClose} />}
        <div className="modal__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </div>
    </div>,
    document.body
  )
}

export function Drawer({ title, subtitle, onClose, children, footer, icon, tone, badge }) {
  useEscape(onClose)
  return createPortal(
    <div className="backdrop backdrop--drawer" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={(e) => e.stopPropagation()}>
        <DialogHead icon={icon} tone={tone} title={title} subtitle={subtitle} badge={badge} onClose={onClose} />
        <div className="drawer__body">{children}</div>
        {footer && <footer className="modal__foot">{footer}</footer>}
      </aside>
    </div>,
    document.body
  )
}

export function Confirm({ title, message, confirmLabel = 'Confirmar', danger, onConfirm, onClose, children }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      size="sm"
      icon={danger ? AlertTriangle : Info}
      tone={danger ? 'danger' : 'accent'}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancelar</button>
          <button className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`} onClick={onConfirm}>{confirmLabel}</button>
        </>
      }
    >
      <p className={`confirm__msg ${danger ? 'confirm__msg--danger' : ''}`}>{message}</p>
      {children}
    </Modal>
  )
}

export function Badge({ tone = 'neutral', children, dot }) {
  return (
    <span className={`badge badge--${tone}`}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  )
}

export function Empty({ icon: Icon = Info, title, text, action }) {
  return (
    <div className="empty">
      <div className="empty__icon"><Icon size={22} /></div>
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {action}
    </div>
  )
}

export function Segmented({ value, onChange, options, size }) {
  return (
    <div className={`segmented ${size === 'sm' ? 'segmented--sm' : ''}`} role="tablist">
      {options.map(([v, label]) => (
        <button key={v} role="tab" aria-selected={value === v} className={value === v ? 'is-active' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function Field({ label, hint, error, children, full }) {
  return (
    <label className={`field ${full ? 'field--full' : ''} ${error ? 'has-error' : ''}`}>
      {label && <span className="field__label">{label}</span>}
      {children}
      {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  )
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </header>
  )
}

export function Stat({ label, value, delta, deltaLabel, icon: Icon, hint, tone = 'accent' }) {
  const up = delta > 0
  const flat = delta === 0 || delta == null || !isFinite(delta)
  return (
    <div className={`stat stat--${tone}`}>
      <div className="stat__top">
        {Icon && <span className="stat__icon"><Icon size={20} /></span>}
        {!flat ? (
          <span className={`delta ${up ? 'delta--up' : 'delta--down'}`}>
            {up ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(0)}%
          </span>
        ) : (
          delta != null && isFinite(delta) && <span className="stat__tag">Sin cambio</span>
        )}
      </div>
      <span className="stat__label">{label}</span>
      <div className="stat__value">{value}</div>
      <div className="stat__foot">
        <span className="text-muted">{deltaLabel || hint}</span>
      </div>
    </div>
  )
}

const TOAST_ICON = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info }
const TOAST_DETAIL = {
  success: 'Cambios guardados correctamente',
  error: 'Revisa la información e intenta de nuevo',
  warning: 'Revisa antes de continuar',
  info: 'Información del sistema',
}

export function Toasts() {
  const { toasts } = useApp()
  return createPortal(
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => {
        const Icon = TOAST_ICON[t.type] || Info
        return (
          <div key={t.id} className={`toast toast--${t.type} ${t.leaving ? 'is-leaving' : ''}`} role="status">
            <span className="toast__icon"><Icon size={19} /></span>
            <span className="toast__text">
              <strong>{t.message}</strong>
              <small>{t.detail || TOAST_DETAIL[t.type] || TOAST_DETAIL.info}</small>
            </span>
            <span className="toast__bar" />
          </div>
        )
      })}
    </div>,
    document.body
  )
}

export function Thumb({ src, alt = '', size = 40 }) {
  return (
    <span className="thumb" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={alt} loading="lazy" /> : null}
    </span>
  )
}

export function Avatar({ name, size = 32 }) {
  const init = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {init}
    </span>
  )
}
