import { useMemo, useState } from 'react'
import { BadgePercent, BarChart3, DollarSign, Download, Receipt, ShoppingBag, Store, Tag, TrendingUp, Trophy, Users, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { BarChart, HBarList } from '../components/Charts'
import { Avatar, DateInput, Empty, Segmented, Stat, Thumb } from '../components/ui'
import { addDays, compactMoney, downloadCSV, money, pct, rangeFor, toInputDate } from '../lib/format'
import { byCategory, byChannel, byDay, byMethod, bySeller, growth, inRange, summarize, topProducts } from '../lib/analytics'

export default function Reports() {
  const { sales, productMap, userMap } = useApp()
  const [preset, setPreset] = useState('30d')
  const [custom, setCustom] = useState({ from: toInputDate(addDays(new Date(), -13)), to: toInputDate(new Date()) })

  const r = useMemo(() => {
    const range =
      preset === 'custom'
        ? rangeFor('custom', { from: new Date(`${custom.from}T00:00`), to: new Date(`${custom.to}T00:00`) })
        : preset === 'all'
          ? [sales.length ? new Date(sales[sales.length - 1].date) : new Date(), rangeFor('today')[1]]
          : rangeFor(preset)
    const span = range[1] - range[0]
    const prevRange = [new Date(range[0] - span), range[0]]
    const cur = inRange(sales, range)
    const prev = inRange(sales, prevRange)
    return {
      range,
      s: summarize(cur),
      p: summarize(prev),
      days: byDay(cur, range),
      cats: byCategory(cur, productMap),
      methods: byMethod(cur),
      channels: byChannel(cur),
      sellers: bySeller(cur, userMap),
      top: topProducts(cur, productMap, 10),
    }
  }, [sales, preset, custom, productMap, userMap])

  const exportCSV = () =>
    downloadCSV(`reporte-ventas-${preset}.csv`, [
      ['Resumen'],
      ['Ventas netas', r.s.revenue],
      ['Costo de mercancía', r.s.cost],
      ['Utilidad bruta', r.s.profit],
      ['Margen', pct(r.s.margin)],
      ['Transacciones', r.s.count],
      ['Ticket promedio', Math.round(r.s.avgTicket)],
      ['Unidades', r.s.units],
      ['Descuentos', r.s.discounts],
      [],
      ['Ventas por día'],
      ['Día', 'Total'],
      ...r.days.map((d) => [d.full, d.value]),
      [],
      ['Productos más vendidos'],
      ['Producto', 'Unidades', 'Ingresos', 'Utilidad'],
      ...r.top.map((t) => [t.name, t.units, t.revenue, t.profit]),
    ])

  const showDays = r.days.length <= 62
  const revDelta = growth(r.s.revenue, r.p.revenue)
  const periodLabel = { '7d': 'Últimos 7 días', '30d': 'Últimos 30 días', month: 'Este mes', all: 'Todo el historial', custom: 'Periodo personalizado' }[preset]
  const sellerMax = Math.max(1, ...r.sellers.map((s) => s.value))

  return (
    <div className="page">
      <section className="hero hero--report">
        <div className="hero__copy">
          <span className="hero__eyebrow"><BarChart3 size={14} /> Reportes · {periodLabel}</span>
          <span className="hero__kicker">Ventas netas del periodo</span>
          <h1 className="hero__amount">{money(r.s.revenue)}</h1>
          <div className="hero__pills">
            {revDelta != null && isFinite(revDelta) && revDelta !== 0 && (
              <span className={`hero__pill ${revDelta > 0 ? 'hero__pill--ok' : 'hero__pill--warn'}`}>
                {revDelta > 0 ? '▲' : '▼'} {Math.abs(revDelta * 100).toFixed(0)}% vs. periodo anterior
              </span>
            )}
            <span className="hero__pill"><Receipt size={14} /> {r.s.count} transacciones</span>
          </div>
          <div className="hero__filters">
            <Segmented value={preset} onChange={setPreset} options={[['7d', '7 días'], ['30d', '30 días'], ['month', 'Este mes'], ['all', 'Todo'], ['custom', 'Personalizado']]} />
            {preset === 'custom' && (
              <div className="date-range">
                <DateInput className="input--sm" value={custom.from} max={custom.to} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label="Desde" />
                <span>a</span>
                <DateInput className="input--sm" value={custom.to} min={custom.from} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label="Hasta" />
              </div>
            )}
          </div>
          <p className="hero__note">Comparado con el periodo anterior de igual duración</p>
        </div>
        <div className="hero__visual hero__visual--report">
          <div className="hero__visual-head">
            <strong>Resumen del periodo</strong>
            <button className="btn btn--white btn--sm" onClick={exportCSV}><Download size={15} /> Exportar</button>
          </div>
          <div className="hero__tiles hero__tiles--grid">
            <div className="hero__tile"><TrendingUp size={16} /><strong>{compactMoney(r.s.profit)}</strong><span>Utilidad bruta</span></div>
            <div className="hero__tile"><BadgePercent size={16} /><strong>{pct(r.s.margin, 0)}</strong><span>Margen</span></div>
            <div className="hero__tile"><ShoppingBag size={16} /><strong>{r.s.units}</strong><span>Unidades vendidas</span></div>
            <div className="hero__tile"><DollarSign size={16} /><strong>{compactMoney(r.s.avgTicket)}</strong><span>Ticket promedio</span></div>
          </div>
        </div>
      </section>

      <section className="stats stats--5">
        <Stat tone="hero" label="Ventas netas" value={money(r.s.revenue)} icon={DollarSign} delta={growth(r.s.revenue, r.p.revenue)} deltaLabel="vs. periodo anterior" />
        <Stat tone="green" label="Utilidad bruta" value={money(r.s.profit)} icon={TrendingUp} delta={growth(r.s.profit, r.p.profit)} deltaLabel={`Margen ${pct(r.s.margin)}`} />
        <Stat tone="blue" label="Transacciones" value={r.s.count} icon={Receipt} delta={growth(r.s.count, r.p.count)} deltaLabel="vs. periodo anterior" />
        <Stat tone="amber" label="Ticket promedio" value={money(r.s.avgTicket)} icon={ShoppingBag} delta={growth(r.s.avgTicket, r.p.avgTicket)} deltaLabel="vs. periodo anterior" />
        <Stat tone="pink" label="Descuentos otorgados" value={money(r.s.discounts)} icon={BadgePercent} hint={`${r.s.units} unidades vendidas`} />
      </section>

      {r.s.count === 0 ? (
        <div className="card"><Empty icon={Receipt} title="No hay ventas en este periodo" text="Selecciona otro rango de fechas." /></div>
      ) : (
        <>
          {showDays && (
            <div className="card card--chart">
              <div className="card__head">
                <div className="card__title-icon"><BarChart3 size={20} /></div>
                <div>
                  <h3>Ventas por día</h3>
                  <p>Ventas completadas · pasa el cursor para ver el detalle</p>
                </div>
                <span className="card__badge">{periodLabel}</span>
              </div>
              <BarChart data={r.days} height={260} format={money} axisFormat={compactMoney} ariaLabel="Ventas por día" />
            </div>
          )}

          <section className="grid-dash grid-dash--3">
            <div className="card">
              <div className="card__head"><div className="card__title-icon"><Tag size={20} /></div><div><h3>Por categoría</h3><p>Ingresos por línea de producto</p></div></div>
              <HBarList data={r.cats} format={compactMoney} />
            </div>
            <div className="card">
              <div className="card__head"><div className="card__title-icon"><Wallet size={20} /></div><div><h3>Por método de pago</h3><p>Recaudo por medio de pago</p></div></div>
              <HBarList data={r.methods} format={compactMoney} />
            </div>
            <div className="card">
              <div className="card__head"><div className="card__title-icon"><Store size={20} /></div><div><h3>Por canal</h3><p>Origen de la venta</p></div></div>
              <HBarList data={r.channels} format={compactMoney} />
            </div>
          </section>

          <section className="grid-dash grid-dash--wide">
            <div className="card card--flush">
              <div className="card__head">
                <div className="card__title-icon"><Trophy size={20} /></div>
                <div><h3>Productos más vendidos</h3><p>Top 10 por ingresos</p></div>
              </div>
              <div className="table-wrap">
                <table className="table table--report">
                  <thead>
                    <tr><th>#</th><th>Producto</th><th className="num">Unidades</th><th className="num">Ingresos</th><th className="num hide-mobile">Utilidad</th><th className="num hide-mobile">Margen</th></tr>
                  </thead>
                  <tbody>
                    {r.top.map((t, i) => (
                      <tr key={t.productId}>
                        <td><span className={`rank ${i === 0 ? 'rank--top' : ''}`}>{i + 1}</span></td>
                        <td><div className="cell-product"><Thumb src={t.product?.image} size={40} /><div><strong>{t.name}</strong><span className="text-muted small mono">{t.product?.sku}</span></div></div></td>
                        <td className="num">{t.units}</td>
                        <td className="num strong t-money">{money(t.revenue)}</td>
                        <td className="num hide-mobile">{money(t.profit)}</td>
                        <td className="num hide-mobile"><span className="margin-pill">{pct(t.revenue ? t.profit / t.revenue : 0, 0)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card card--flush">
              <div className="card__head">
                <div className="card__title-icon"><Users size={20} /></div>
                <div><h3>Pedidos atendidos</h3><p>Ventas confirmadas por cada usuario</p></div>
              </div>
              <ul className="sellers">
                {r.sellers.map((s) => (
                  <li key={s.id}>
                    <Avatar name={s.name} size={42} />
                    <div className="sellers__main">
                      <div className="sellers__row">
                        <strong>{s.name}</strong>
                        <strong className="t-money">{money(s.value)}</strong>
                      </div>
                      <div className="sellers__bar"><span style={{ width: `${(s.value / sellerMax) * 100}%` }} /></div>
                      <span className="text-muted small">{s.count} ventas · {s.units} unidades</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
