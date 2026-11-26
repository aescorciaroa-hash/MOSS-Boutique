import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertTriangle, ArrowRight, BarChart3, DollarSign, LayoutDashboard, Package, Receipt, ShoppingBag, ShoppingCart, TrendingUp } from 'lucide-react'
import { useApp, stockOf } from '../context/AppContext'
import { AreaChart, GoalRing, HBarList } from '../components/Charts'
import { Badge, Empty, Segmented, Stat, Thumb } from '../components/ui'
import { addDays, compactMoney, fmtTime, money, rangeFor, startOfDay, fmtDate } from '../lib/format'
import { byCategory, byDay, growth, inRange, summarize, topProducts } from '../lib/analytics'
import { PAYMENT_METHODS } from '../lib/seed'
import { invoiceNo } from '../components/Receipt'

export default function Dashboard() {
  const { sales, productMap, customerMap, lowStock, user, products, settings } = useApp()
  const [span, setSpan] = useState('14')
  const navigate = useNavigate()

  const data = useMemo(() => {
    const today = summarize(inRange(sales, rangeFor('today')))
    const yesterday = summarize(inRange(sales, rangeFor('yesterday')))
    const week = summarize(inRange(sales, rangeFor('7d')))
    const month = rangeFor('month')
    const monthSales = inRange(sales, month)
    const m = summarize(monthSales)
    const now = new Date()
    const prevMonthFrom = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevMonthTo = new Date(prevMonthFrom.getFullYear(), prevMonthFrom.getMonth(), Math.min(now.getDate(), 28) + 1)
    const pm = summarize(inRange(sales, [prevMonthFrom, prevMonthTo]))
    const days = Number(span)
    const chartRange = [addDays(startOfDay(), -(days - 1)), addDays(startOfDay(), 1)]
    return {
      today,
      yesterday,
      week,
      m,
      pm,
      chart: byDay(inRange(sales, chartRange), chartRange),
      cats: byCategory(monthSales, productMap),
      top: topProducts(monthSales, productMap, 5),
    }
  }, [sales, productMap, span])

  const recent = sales.slice(0, 6)
  const pendingCount = sales.filter((s) => s.status === 'pendiente').length
  const inventoryUnits = products.reduce((a, p) => a + stockOf(p), 0)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="page">
      <section className="hero">
        <div className="hero__copy">
          <span className="hero__eyebrow"><LayoutDashboard size={14} /> {settings.storeName} · Panel de {user.role === 'admin' ? 'administración' : 'ventas'}</span>
          <h1>{greeting}, {user.name.split(' ')[0]} <span className="hero__wave">👋</span></h1>
          <p>Este es el resumen de tu boutique en tiempo real. Desde aquí confirmas los pedidos en línea, revisas el inventario y sigues tus metas.</p>
          <div className="hero__actions">
            <button className="btn btn--primary btn--lg" onClick={() => navigate(pendingCount > 0 ? '/ventas?estado=pendiente' : '/ventas')}><ShoppingCart size={18} /> {pendingCount > 0 ? `${pendingCount} pedido${pendingCount > 1 ? 's' : ''} por confirmar` : 'Pedidos en línea'}</button>
            <button className="btn btn--glass btn--lg" onClick={() => navigate('/ventas')}><Receipt size={18} /> Ver ventas</button>
            <button className="btn btn--glass btn--lg" onClick={() => navigate('/reportes')}><BarChart3 size={18} /> Ver reportes</button>
          </div>
          <div className="hero__pills">
            <span className="hero__pill"><DollarSign size={14} /> Ventas de hoy: {money(data.today.revenue)}</span>
            <span className={`hero__pill ${lowStock.length ? 'hero__pill--warn' : 'hero__pill--ok'}`}>
              <i /> {lowStock.length ? `${lowStock.length} producto${lowStock.length > 1 ? 's' : ''} con stock bajo` : 'Inventario saludable'}
            </span>
          </div>
        </div>
        <div className="hero__visual">
          <div className="hero__photo"><img src="/img/brand/portada-rojo.jpg" alt="Modelo con conjunto rojo frente al cielo azul" /></div>
          <div className="hero__tiles">
            <div className="hero__tile"><Receipt size={16} /><strong>{data.today.count}</strong><span>Ventas hoy</span></div>
            <div className="hero__tile"><ShoppingBag size={16} /><strong>{data.today.units}</strong><span>Unidades hoy</span></div>
            <div className="hero__tile"><AlertTriangle size={16} /><strong>{lowStock.length}</strong><span>Stock bajo</span></div>
            <div className="hero__tile"><Package size={16} /><strong>{products.length}</strong><span>Productos</span></div>
          </div>
        </div>
      </section>

      {settings.goalsEnabled !== false && <section className="goals">
        {[
          ['Hoy', data.today.revenue, settings.goalDay],
          ['7 días', data.week.revenue, settings.goalWeek],
          ['Este mes', data.m.revenue, settings.goalMonth],
        ].map(([label, value, goal]) => {
          const left = Math.max(0, (goal || 0) - value)
          return (
            <div key={label} className="goal">
              <GoalRing value={value} goal={goal} />
              <div className="goal__body">
                <strong className="goal__value">{money(value)} <small>COP</small></strong>
                <span className="goal__label">Facturado · {label}</span>
                <span className="goal__target">Objetivo: {money(goal)}</span>
                <span className={`goal__hint ${left === 0 && goal > 0 ? 'is-done' : ''}`}>
                  {!goal ? 'Define la meta en Configuración' : left === 0 ? '✓ Meta cumplida' : `Faltan ${money(left)}`}
                </span>
              </div>
            </div>
          )
        })}
      </section>}

      <section className="stats">
        <Stat tone="hero" label="Ventas de hoy" value={money(data.today.revenue)} icon={DollarSign} delta={growth(data.today.revenue, data.yesterday.revenue)} deltaLabel="vs. ayer" />
        <Stat tone="blue" label="Transacciones hoy" value={data.today.count} icon={Receipt} delta={growth(data.today.count, data.yesterday.count)} deltaLabel="vs. ayer" />
        <Stat tone="green" label="Ventas del mes" value={money(data.m.revenue)} icon={TrendingUp} delta={growth(data.m.revenue, data.pm.revenue)} deltaLabel="vs. mes anterior" />
        <Stat tone="amber" label="Ticket promedio" value={money(data.m.avgTicket)} icon={ShoppingBag} hint={`${data.m.units} unidades este mes`} />
      </section>

      <section className="grid-dash">
        <div className="card card--chart">
          <div className="card__head">
            <div>
              <h3>Ventas por día</h3>
              <p>Total facturado en ventas completadas</p>
            </div>
            <Segmented size="sm" value={span} onChange={setSpan} options={[['7', '7 días'], ['14', '14 días'], ['30', '30 días']]} />
          </div>
          <AreaChart data={data.chart} format={money} axisFormat={compactMoney} ariaLabel="Ventas por día" />
        </div>

        <div className="card">
          <div className="card__head">
            <div>
              <h3>Ventas por categoría</h3>
              <p>Este mes</p>
            </div>
          </div>
          {data.cats.length ? <HBarList data={data.cats} format={compactMoney} /> : <Empty title="Sin ventas este mes" />}
        </div>
      </section>

      <section className="grid-dash grid-dash--3">
        <div className="card card--flush">
          <div className="card__head">
            <div>
              <h3>Últimas ventas</h3>
            </div>
            <Link to="/ventas" className="link">Ver todas <ArrowRight size={14} /></Link>
          </div>
          {recent.length ? (
            <ul className="list">
              {recent.map((s) => (
                <li key={s.id} className="list__item" onClick={() => navigate(`/ventas?id=${s.id}`)}>
                  <div className="list__icon"><Receipt size={16} /></div>
                  <div className="list__main">
                    <strong>{invoiceNo(settings, s.number)} · {customerMap[s.customerId]?.name || 'Consumidor final'}</strong>
                    <span className="text-muted">
                      {fmtDate(s.date, { day: 'numeric', month: 'short' })} {fmtTime(s.date)} · {PAYMENT_METHODS.find((m) => m.id === s.payments[0]?.method)?.name}
                    </span>
                  </div>
                  <div className="list__end">
                    <strong className={s.status === 'anulada' ? 'strike' : ''}>{money(s.total)}</strong>
                    {s.status === 'anulada' && <Badge tone="danger">Anulada</Badge>}
                    {s.status === 'pendiente' && <Badge tone="warning">Pendiente</Badge>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon={Receipt} title="Aún no hay ventas" text="Registra tu primera venta desde el punto de venta." />
          )}
        </div>

        <div className="card card--flush">
          <div className="card__head">
            <div>
              <h3>Más vendidos del mes</h3>
            </div>
            <Link to="/reportes" className="link">Reportes <ArrowRight size={14} /></Link>
          </div>
          {data.top.length ? (
            <ul className="list">
              {data.top.map((t, i) => (
                <li key={t.productId} className="list__item">
                  <span className="rank">{i + 1}</span>
                  <Thumb src={t.product?.image} size={38} />
                  <div className="list__main">
                    <strong>{t.name}</strong>
                    <span className="text-muted">{t.units} unidades</span>
                  </div>
                  <div className="list__end"><strong>{money(t.revenue)}</strong></div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="Sin datos este mes" />
          )}
        </div>

        <div className="card card--flush">
          <div className="card__head">
            <div>
              <h3>Alertas de stock</h3>
              <p>{inventoryUnits} unidades en inventario</p>
            </div>
            <Link to="/inventario?stock=low" className="link">Inventario <ArrowRight size={14} /></Link>
          </div>
          {lowStock.length ? (
            <ul className="list">
              {lowStock.slice(0, 6).map((p) => {
                const out = p.variants.filter((v) => v.stock === 0)
                return (
                  <li key={p.id} className="list__item" onClick={() => navigate(`/inventario?q=${encodeURIComponent(p.sku)}`)}>
                    <Thumb src={p.image} size={38} />
                    <div className="list__main">
                      <strong>{p.type} {p.name}</strong>
                      <span className="text-muted">{p.sku} · {stockOf(p)} und. en total</span>
                    </div>
                    <div className="list__end">
                      {out.length ? (
                        <Badge tone="danger"><AlertTriangle size={12} /> {out.length} agotada{out.length > 1 ? 's' : ''}</Badge>
                      ) : (
                        <Badge tone="warning"><AlertTriangle size={12} /> Bajo</Badge>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty icon={Package} title="Inventario saludable" text="Ningún producto está por debajo del mínimo." />
          )}
        </div>
      </section>
    </div>
  )
}
