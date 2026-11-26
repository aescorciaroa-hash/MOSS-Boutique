import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, BarChart3, Bell, ChevronRight, ChevronsLeft, Clock, PackageX, X, LayoutDashboard, LogOut, Menu, Moon, Package, Plus, Receipt, Search, Settings, ShoppingBag, ShoppingCart, Sun, Users,
} from 'lucide-react'
import { useApp, stockOf } from '../context/AppContext'
import { Thumb } from './ui'
import { fmtDate, money, rangeFor } from '../lib/format'
import { inRange, summarize } from '../lib/analytics'

const NAV = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, end: true },
  { to: '/ventas', label: 'Ventas', icon: Receipt },
  { to: '/inventario', label: 'Inventario', icon: Package },
  { to: '/clientes', label: 'Clientes', icon: Users },
  { to: '/reportes', label: 'Reportes', icon: BarChart3, admin: true },
  { to: '/configuracion', label: 'Configuración', icon: Settings, admin: true },
]


export default function Layout() {
  const { user, isAdmin, logout, theme, setTheme, lowStock, settings, sales, customerMap } = useApp()
  // Portátil: el menú queda compacto (solo iconos) y se abre solo al pasar el mouse.
  // Solo en computador (pantalla ancha y con mouse); en celular/tablet el menú es el panel completo de ☰.
  const desktopQuery = '(min-width: 861px) and (hover: hover)'
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia(desktopQuery).matches)
  useEffect(() => {
    const mq = window.matchMedia(desktopQuery)
    const on = () => setIsDesktop(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  const [peek, setPeek] = useState(false)
  const peekTimer = useRef(null)
  const collapsed = isDesktop && !peek
  const onSideEnter = () => { if (!isDesktop) return; clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => setPeek(true), 90) }
  const onSideLeave = () => { clearTimeout(peekTimer.current); peekTimer.current = setTimeout(() => setPeek(false), 140) }
  const [mobileOpen, setMobileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const notifRef = useRef(null)


  useEffect(() => {
    setMobileOpen(false)
    setPeek(false)
    setNotifOpen(false)
  }, [pathname])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') setNotifOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [navigate])

  const current = NAV.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))) || NAV[0]
  const today = useMemo(() => summarize(inRange(sales, rangeFor('today'))), [sales])
  const searchInventory = (e) => {
    e.preventDefault()
    const q = new FormData(e.currentTarget).get('q')
    navigate(`/inventario?q=${encodeURIComponent(q || '')}`)
    e.currentTarget.reset()
    e.currentTarget.querySelector('input')?.blur()
  }
  const pendingList = useMemo(() => sales.filter((s) => s.status === 'pendiente'), [sales])
  const pending = pendingList.length
  const outCount = lowStock.filter((p) => p.variants.some((v) => v.stock === 0)).length
  const [brandFirst, ...brandRest] = (settings.storeName || 'MOSS').split(' ')

  return (
    <div className={`shell ${isDesktop ? `shell--auto ${collapsed ? 'shell--collapsed' : 'shell--peek'}` : ''} ${mobileOpen ? 'shell--mobile-open' : ''}`}>
      <aside className="sidebar" onMouseEnter={onSideEnter} onMouseLeave={onSideLeave} onFocus={onSideEnter} onBlur={onSideLeave}>
        <div className="sidebar__brand">
          <div className="brand-mark"><ShoppingBag size={20} strokeWidth={2.2} /></div>
          <div className="sidebar__brand-text">
            <strong>{brandFirst}{brandRest.length > 0 && <em> {brandRest.join(' ')}</em>}</strong>
            <span>Sistema de ventas</span>
          </div>
        </div>
        <nav className="sidebar__nav">
          {NAV.filter((n) => !n.admin || isAdmin).map((n, i) => (
            <div key={n.to}>
              {i === 4 && <span className="sidebar__section">Administración</span>}
              <NavLink to={n.to} end={n.end} className="nav-item" title={collapsed ? n.label : undefined}>
                <n.icon size={20} />
                <span className="nav-item__label">{n.label}</span>
                {n.kbd && <kbd>{n.kbd}</kbd>}
                {n.to === '/inventario' && lowStock.length > 0 && <span className="nav-item__count">{lowStock.length}</span>}
                {n.to === '/ventas' && pending > 0 && <span className="nav-item__count nav-item__count--warn" title="Pedidos en línea pendientes">{pending}</span>}
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="sidebar__foot">
          <button className="nav-item sidebar__logout" onClick={logout} title="Cerrar sesión">
            <LogOut size={20} />
            <span className="nav-item__label">Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />
      {notifOpen && createPortal(
        <>
          <div className="notif-scrim" onClick={() => setNotifOpen(false)} />
          <aside className="notif-panel" role="dialog" aria-label="Notificaciones">
            <div className="notif-panel__head">
              <span className="notif-panel__icon"><Bell size={20} /></span>
              <div>
                <strong>Notificaciones</strong>
                <span>{pendingList.length + lowStock.length} pendiente{pendingList.length + lowStock.length === 1 ? '' : 's'} de revisar</span>
              </div>
              <button className="btn-icon btn-icon--sm" onClick={() => setNotifOpen(false)} aria-label="Cerrar"><X size={18} /></button>
            </div>

            <div className="notif-panel__body">
              <div className="notif-panel__chips">
                <span className="notif-chip ic--amber"><Clock size={14} /> {pendingList.length} por confirmar</span>
                <span className="notif-chip ic--red"><PackageX size={14} /> {outCount} agotado{outCount === 1 ? '' : 's'}</span>
                <span className="notif-chip ic--amber"><AlertTriangle size={14} /> {lowStock.length - outCount} stock bajo</span>
              </div>

              <section>
                <h4 className="notif-panel__label">Pedidos en línea por confirmar</h4>
                {pendingList.length === 0 ? (
                  <p className="notif-panel__empty">No hay pedidos esperando confirmación.</p>
                ) : (
                  <ul className="notif-list">
                    {pendingList.map((sale) => (
                      <li key={sale.id}>
                        <button type="button" onClick={() => { setNotifOpen(false); navigate(`/ventas?estado=pendiente&id=${sale.id}`) }}>
                          <span className="notif-list__icon ic--amber"><ShoppingBag size={17} /></span>
                          <div>
                            <strong>{customerMap[sale.customerId]?.name || 'Cliente de la tienda'}</strong>
                            <span>{fmtDate(sale.date, { day: 'numeric', month: 'short' })} · {sale.items.reduce((a, i) => a + i.qty, 0)} artículos · {money(sale.total)}</span>
                          </div>
                          <ChevronRight size={16} className="notif-list__go" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h4 className="notif-panel__label">Alertas de inventario</h4>
                {lowStock.length === 0 ? (
                  <p className="notif-panel__empty">Todo el inventario está en buen nivel.</p>
                ) : (
                  <ul className="notif-list">
                    {lowStock.map((p) => {
                      const out = p.variants.filter((v) => v.stock === 0).length
                      return (
                        <li key={p.id}>
                          <button type="button" onClick={() => { setNotifOpen(false); navigate(`/inventario?q=${encodeURIComponent(p.sku)}`) }}>
                            <Thumb src={p.image} size={42} />
                            <div>
                              <strong>{p.type} {p.name}</strong>
                              <span className={out > 0 ? 'text-danger' : 'text-warning'}>
                                {out > 0 ? `${out} variante${out > 1 ? 's' : ''} agotada${out > 1 ? 's' : ''}` : 'Stock bajo'} · {stockOf(p)} und.
                              </span>
                            </div>
                            <ChevronRight size={16} className="notif-list__go" />
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </div>

            <div className="notif-panel__foot">
              <button className="btn btn--secondary" onClick={() => { setNotifOpen(false); navigate('/ventas?estado=pendiente') }}><ShoppingBag size={16} /> Ver pedidos</button>
              <button className="btn btn--primary" onClick={() => { setNotifOpen(false); navigate('/inventario?stock=low') }}><Package size={16} /> Ver stock bajo</button>
            </div>
          </aside>
        </>,
        document.body,
      )}

      <div className="main">
        <header className="topbar">
          <button className="btn-icon show-mobile" onClick={() => setMobileOpen(true)} aria-label="Menú">
            <Menu size={20} />
          </button>
          <div className="topbar__page">
            <span className="topbar__page-icon"><current.icon size={22} /></span>
            <div>
              <span className="topbar__eyebrow hide-mobile">Panel · {fmtDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}</span>
              <span className="topbar__eyebrow topbar__eyebrow--short">{fmtDate(new Date(), { weekday: 'short', day: 'numeric', month: 'short' })}</span>
              <div className="topbar__title">{current.label}</div>
            </div>
          </div>

          <form className="topbar__search hide-mobile" onSubmit={searchInventory}>
            <Search size={16} />
            <input name="q" placeholder="Buscar en inventario…" autoComplete="off" />
            <kbd>Enter</kbd>
          </form>

          <div className="topbar__actions">
            <div className="status-pill hide-mobile" title="Total facturado hoy">
              <span className="status-pill__dot" />
              <div>
                <strong>Ventas de hoy</strong>
                <small>{money(today.revenue)} · {today.count} {today.count === 1 ? 'venta' : 'ventas'}</small>
              </div>
            </div>
            {pending > 0 && (
              <button className="btn btn--dark hide-mobile" onClick={() => navigate('/ventas?estado=pendiente')}>
                <ShoppingBag size={18} /> {pending} pedido{pending > 1 ? 's' : ''} por confirmar
              </button>
            )}
            <div className="icon-group">
              <button className={`btn-icon ${notifOpen ? 'is-active' : ''}`} onClick={() => setNotifOpen((o) => !o)} aria-label="Notificaciones" title="Notificaciones">
                <Bell size={19} />
                {(lowStock.length > 0 || pending > 0) && <span className="btn-icon__dot" />}
              </button>
              <button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Cambiar tema" title="Cambiar tema">
                {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
              </button>
            </div>
          </div>
        </header>
        <div className="topbar-strip">
          <button type="button" className="status-pill status-pill--strip" title="Ver ventas de hoy" onClick={() => navigate('/ventas')}>
            <span className="status-pill__dot" />
            <div>
              <strong>Ventas de hoy</strong>
              <small className="status-pill__detail">{today.count} {today.count === 1 ? 'venta' : 'ventas'} · {today.units} {today.units === 1 ? 'prenda' : 'prendas'}</small>
              <small className="status-pill__compact">{money(today.revenue)} · {today.count} {today.count === 1 ? 'venta' : 'ventas'}</small>
            </div>
            <b className="status-pill__amount">{money(today.revenue)}</b>
            <ChevronRight size={18} className="status-pill__go" />
          </button>
          {pending > 0 && (
            <button className="btn btn--dark" onClick={() => navigate('/ventas?estado=pendiente')}>
              <ShoppingBag size={17} /> {pending} por confirmar
            </button>
          )}
          <form className="topbar__search" onSubmit={searchInventory}>
            <Search size={16} />
            <input name="q" placeholder="Buscar en inventario…" autoComplete="off" enterKeyHint="search" />
          </form>
        </div>
        <main className="content">
          <Outlet />
        </main>
      </div>

    </div>
  )
}
