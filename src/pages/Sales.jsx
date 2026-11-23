import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, CheckCircle2, Download, Printer, Receipt, Search, ShoppingBag, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PAYMENT_METHODS } from '../lib/seed'
import { compactMoney, downloadCSV, fmtDate, fmtDateTime, fmtTime, money, normalize, PRESETS, rangeFor } from '../lib/format'
import { inRange, summarize } from '../lib/analytics'
import { Badge, Confirm, Drawer, Empty, Field, Pager, Segmented, Select, Thumb, usePaged } from '../components/ui'
import ReceiptModal, { invoiceNo } from '../components/Receipt'

const methodName = (id) => PAYMENT_METHODS.find((m) => m.id === id)?.name || id

export function SaleDetail({ sale, onClose }) {
  const { customerMap, userMap, productMap, isAdmin, voidSale, confirmOrder, toast, settings } = useApp()
  const [printing, setPrinting] = useState(false)
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const customer = customerMap[sale.customerId]

  return (
    <Drawer
      icon={Receipt}
      tone={sale.status === 'anulada' ? 'danger' : 'accent'}
      badge={sale.status === 'anulada' ? 'Anulada' : sale.status === 'pendiente' ? 'Pedido pendiente' : 'Completada'}
      title={`${sale.status === 'pendiente' ? 'Pedido' : 'Factura'} ${invoiceNo(settings, sale.number)}`}
      subtitle={fmtDateTime(sale.date)}
      onClose={onClose}
      footer={
        <>
          {isAdmin && sale.status !== 'anulada' && (
            <button className="btn btn--danger-ghost" onClick={() => setVoiding(true)}><Ban size={16} /> {sale.status === 'pendiente' ? 'Rechazar pedido' : 'Anular venta'}</button>
          )}
          {isAdmin && sale.status === 'pendiente' && (
            <button className="btn btn--primary" onClick={() => { confirmOrder(sale.id); toast('Pedido confirmado', 'success', `${invoiceNo(settings, sale.number)} ya cuenta como venta completada`) }}><CheckCircle2 size={16} /> Confirmar pedido</button>
          )}
          <button className="btn btn--secondary" onClick={() => setPrinting(true)}><Printer size={16} /> Comprobante</button>
        </>
      }
    >
      {sale.status === 'pendiente' && (
        <div className="pay__note"><b>Pedido de la tienda en línea.</b> El stock está apartado. Confirma cuando recibas el pago, o recházalo para devolver las unidades al inventario.</div>
      )}
      {sale.status === 'anulada' && (
        <div className="alert alert--danger">
          <strong>Venta anulada.</strong> {sale.voidReason} {sale.voidedAt && `· ${fmtDateTime(sale.voidedAt)}`}. El inventario fue restituido.
        </div>
      )}
      <dl className="dl">
        <div><dt>Estado</dt><dd>{sale.status === 'anulada' ? <Badge tone="danger">Anulada</Badge> : sale.status === 'pendiente' ? <Badge tone="warning" dot>Pendiente</Badge> : <Badge tone="success" dot>Completada</Badge>}</dd></div>
        <div><dt>Cliente</dt><dd>{customer ? <>{customer.name}<br /><span className="text-muted">{customer.phone}</span></> : 'Consumidor final'}</dd></div>
        <div><dt>Atendido por</dt><dd>{userMap[sale.sellerId]?.name || (sale.status === 'pendiente' ? 'Sin confirmar' : '—')}</dd></div>
        <div><dt>Canal</dt><dd>{sale.channel || 'Tienda'}</dd></div>
        {sale.note && <div><dt>Nota</dt><dd>{sale.note}</dd></div>}
      </dl>

      <h4 className="section-title">Artículos</h4>
      <ul className="lines">
        {sale.items.map((i, k) => (
          <li key={k}>
            <Thumb src={productMap[i.productId]?.image} size={44} />
            <div className="lines__main">
              <strong>{i.name}</strong>
              <span className="text-muted">{i.sku} · {i.color}{i.size !== 'Única' ? ` · Talla ${i.size}` : ''}</span>
            </div>
            <div className="lines__end">
              <strong>{money(i.qty * i.price)}</strong>
              <span className="text-muted">{i.qty} × {money(i.price)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="totals">
        <div><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
        {sale.discount > 0 && <div><span>Descuento</span><span>−{money(sale.discount)}</span></div>}
        {sale.tax > 0 && <div><span>Impuesto</span><span>{money(sale.tax)}</span></div>}
        <div className="totals__grand"><span>Total</span><span>{money(sale.total)}</span></div>
      </div>

      <h4 className="section-title">Pagos</h4>
      <div className="totals">
        {sale.payments.map((p, k) => <div key={k}><span>{methodName(p.method)}</span><span>{money(p.amount)}</span></div>)}
        {sale.change > 0 && <div><span>Recibido / cambio</span><span>{money(sale.received)} / {money(sale.change)}</span></div>}
      </div>

      {printing && <ReceiptModal sale={sale} onClose={() => setPrinting(false)} />}
      {voiding && (
        <Confirm
          title="Anular venta"
          danger
          confirmLabel="Anular venta"
          message="La venta quedará marcada como anulada y las unidades volverán al inventario. Esta acción no se puede deshacer."
          onClose={() => setVoiding(false)}
          onConfirm={() => {
            voidSale(sale.id, reason.trim() || 'Sin motivo')
            setVoiding(false)
            toast('Venta anulada', 'success', 'Las unidades volvieron al inventario')
          }}
        >
          <Field label="Motivo">
            <input className="input" autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: error en el registro, cliente desistió…" />
          </Field>
        </Confirm>
      )}
    </Drawer>
  )
}

export default function Sales() {
  const { sales, customerMap, userMap, users, settings } = useApp()
  const [params, setParams] = useSearchParams()
  const urlStatus = params.get('estado')
  const [preset, setPreset] = useState(() => (urlStatus === 'pendiente' ? 'all' : '30d'))
  const [q, setQ] = useState('')
  const [method, setMethod] = useState('all')
  const [status, setStatus] = useState(() => urlStatus || 'all')
  // El filtro sigue a la URL: el menú "Ventas" muestra todo y los accesos a pedidos muestran los pendientes.
  useEffect(() => {
    setStatus(urlStatus || 'all')
    if (urlStatus === 'pendiente') setPreset('all')
  }, [urlStatus])
  const [seller, setSeller] = useState('all')
  const openId = params.get('id')
  const open = openId ? sales.find((s) => s.id === openId) : null


  const filtered = useMemo(() => {
    const n = normalize(q)
    return inRange(sales, rangeFor(preset)).filter((s) => {
      if (method !== 'all' && !s.payments.some((p) => p.method === method)) return false
      if (status !== 'all' && s.status !== status) return false
      if (seller !== 'all' && s.sellerId !== seller) return false
      if (n) {
        const hay = normalize(`${s.number} ${invoiceNo(settings, s.number)} ${customerMap[s.customerId]?.name || ''} ${s.items.map((i) => `${i.name} ${i.sku}`).join(' ')}`)
        if (!hay.includes(n)) return false
      }
      return true
    })
  }, [sales, preset, q, method, status, seller, customerMap])

  const sum = summarize(filtered)
  const pg = usePaged(filtered)
  const rows = pg.rows

  const exportCSV = () =>
    downloadCSV(`ventas-${preset}.csv`, [
      ['N°', 'Fecha', 'Hora', 'Cliente', 'Atendido por', 'Canal', 'Artículos', 'Subtotal', 'Descuento', 'Total', 'Métodos', 'Estado'],
      ...filtered.map((s) => [
        s.number,
        fmtDate(s.date, { year: 'numeric', month: '2-digit', day: '2-digit' }),
        fmtTime(s.date),
        customerMap[s.customerId]?.name || 'Consumidor final',
        userMap[s.sellerId]?.name || '',
        s.channel || 'Tienda',
        s.items.reduce((a, i) => a + i.qty, 0),
        s.subtotal,
        s.discount,
        s.total,
        s.payments.map((p) => methodName(p.method)).join(' + '),
        s.status,
      ]),
    ])

  return (
    <div className="page">
      <section className="hero hero--report">
        <div className="hero__copy">
          <span className="hero__eyebrow"><Receipt size={14} /> Ventas · {PRESETS.find(([v]) => v === preset)?.[1] || 'Periodo'}</span>
          <span className="hero__kicker">Total facturado con los filtros actuales</span>
          <h1 className="hero__amount">{money(sum.revenue)}</h1>
          <div className="hero__pills">
            <span className="hero__pill"><Receipt size={14} /> {sum.count} ventas</span>
            {sum.voided > 0 ? (
              <span className="hero__pill hero__pill--warn"><i /> {sum.voided} anulada{sum.voided > 1 ? 's' : ''}</span>
            ) : (
              <span className="hero__pill hero__pill--ok"><i /> Sin anulaciones</span>
            )}
          </div>
          <div className="hero__filters">
            <Segmented value={preset} onChange={setPreset} options={PRESETS} />
          </div>
          <div className="hero__actions">
            <button className="btn btn--glass btn--lg" onClick={exportCSV}><Download size={18} /> Exportar CSV</button>
          </div>
        </div>
        <div className="hero__visual hero__visual--report">
          <div className="hero__visual-head">
            <strong>Resumen de ventas</strong>
          </div>
          <div className="hero__tiles hero__tiles--grid">
            <div className="hero__tile"><Receipt size={16} /><strong>{sum.count}</strong><span>Ventas</span></div>
            <div className="hero__tile"><Wallet size={16} /><strong>{compactMoney(sum.avgTicket)}</strong><span>Ticket promedio</span></div>
            <div className="hero__tile"><ShoppingBag size={16} /><strong>{sum.units}</strong><span>Unidades</span></div>
            <div className="hero__tile"><Ban size={16} /><strong>{sum.voided}</strong><span>Anuladas</span></div>
          </div>
        </div>
      </section>

      <div className="card card--flush">
        <div className="toolbar">
          <div className="input-icon toolbar__search">
            <Search size={16} />
            <input className="input" placeholder="Buscar por N°, cliente o producto…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="input input--sm toolbar__select" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="all">Todos los métodos</option>
            {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select className="input input--sm toolbar__select" value={seller} onChange={(e) => setSeller(e.target.value)}>
            <option value="all">Atendido por: todos</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </Select>
          <Select className="input input--sm toolbar__select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pedidos pendientes</option>
            <option value="completada">Completadas</option>
            <option value="anulada">Anuladas</option>
          </Select>
        </div>

        {rows.length ? (
          <>
            <div className="table-wrap">
              <table className="table table--hover">
                <thead>
                  <tr>
                    <th>N° venta</th>
                    <th>Fecha</th>
                    <th>Cliente</th>
                    <th className="hide-mobile">Atendido por</th>
                    <th className="hide-mobile">Canal</th>
                    <th className="num">Art.</th>
                    <th>Pago</th>
                    <th className="num">Total</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} onClick={() => setParams(urlStatus ? { estado: urlStatus, id: s.id } : { id: s.id })}>
                      <td className="mono">{invoiceNo(settings, s.number)}</td>
                      <td><div>{fmtDate(s.date, { day: '2-digit', month: 'short' })}</div><span className="text-muted small">{fmtTime(s.date)}</span></td>
                      <td>{customerMap[s.customerId]?.name || <span className="text-muted">Consumidor final</span>}</td>
                      <td className="hide-mobile">{userMap[s.sellerId]?.name || '—'}</td>
                      <td className="hide-mobile">{s.channel || 'Tienda'}</td>
                      <td className="num">{s.items.reduce((a, i) => a + i.qty, 0)}</td>
                      <td>{s.payments.map((p) => methodName(p.method)).join(' + ')}</td>
                      <td className={`num strong ${s.status === 'anulada' ? 'strike' : ''}`}>{money(s.total)}</td>
                      <td>{s.status === 'anulada' ? <Badge tone="danger">Anulada</Badge> : s.status === 'pendiente' ? <Badge tone="warning" dot>Pendiente</Badge> : <Badge tone="success" dot>Completada</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager pg={pg} noun="ventas" />
          </>
        ) : (
          status === 'pendiente' && !q && method === 'all' && seller === 'all' ? (
            <Empty icon={CheckCircle2} title="No hay pedidos por confirmar" text="Todos los pedidos de la tienda en línea ya están confirmados."
              action={<button className="btn btn--primary" onClick={() => { setStatus('all'); setPreset('30d'); setParams({}, { replace: true }) }}><Receipt size={16} /> Ver todas las ventas</button>} />
          ) : (
            <Empty icon={Receipt} title="No hay ventas para estos filtros" text="Ajusta el periodo o los filtros de búsqueda." />
          )
        )}
      </div>

      {open && <SaleDetail sale={open} onClose={() => setParams(urlStatus ? { estado: urlStatus } : {})} />}
    </div>
  )
}
