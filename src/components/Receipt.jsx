import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import JsBarcode from 'jsbarcode'
import { Ban, CheckCircle2, Maximize2, Minimize2, Printer, Receipt as ReceiptIcon } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { PAYMENT_METHODS } from '../lib/seed'
import { fmtDate, fmtTime, money, number } from '../lib/format'
import { Modal } from './ui'

export const invoiceNo = (settings, n) => `${settings.invoicePrefix || 'FV'}-${String(n).padStart(6, '0')}`

function Barcode({ value }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return
    try {
      JsBarcode(ref.current, value, { format: 'CODE128', width: 1.4, height: 38, displayValue: false, margin: 0, background: 'transparent', lineColor: '#000' })
    } catch {
      /* valor no codificable */
    }
  }, [value])
  return <svg ref={ref} className="pos-ticket__barcode" />
}

const Row = ({ l, r, strong, big }) => (
  <div className={`pt-row ${strong ? 'pt-row--strong' : ''} ${big ? 'pt-row--big' : ''}`}>
    <span>{l}</span>
    <span>{r}</span>
  </div>
)

export function ReceiptContent({ sale, settings: override }) {
  const ctx = useApp()
  const { customerMap, userMap } = ctx
  const s = override || ctx.settings
  const customer = sale.customerId ? customerMap[sale.customerId] : null
  const seller = userMap[sale.sellerId]
  const units = sale.items.reduce((a, i) => a + i.qty, 0)
  const no = invoiceNo(s, sale.number)
  const narrow = s.paperWidth === '58'

  return (
    <div className={`pos-ticket ${narrow ? 'pos-ticket--58' : ''}`}>
      <div className="pt-center">
        <div className="pt-logo">{(s.storeName || 'MOSS').toUpperCase()}</div>
        {s.legalName && s.legalName !== s.storeName && <div>{s.legalName}</div>}
        {s.nit && <div>NIT: {s.nit}</div>}
        {s.taxRegime && <div>{s.taxRegime}</div>}
        {s.address && <div>{s.address}</div>}
        {s.phone && <div>Tel: {s.phone}</div>}
        {s.instagram && <div>{s.instagram}</div>}
      </div>

      <div className="pt-sep" />
      <div className="pt-center pt-title">{(s.invoiceTitle || 'FACTURA DE VENTA').toUpperCase()}</div>
      <div className="pt-center pt-strong">No. {no}</div>
      {s.resolution && <div className="pt-center pt-small">{s.resolution}</div>}
      <div className="pt-sep" />

      <Row l="Fecha:" r={fmtDate(sale.date, { day: '2-digit', month: '2-digit', year: 'numeric' })} />
      <Row l="Hora:" r={fmtTime(sale.date)} />
      {s.showSeller !== false && <Row l="Atendió:" r={seller?.name || 'Tienda en línea'} />}
      <Row l="Cliente:" r={customer?.name || 'CONSUMIDOR FINAL'} />
      {s.showCustomerDoc !== false && <Row l="CC/NIT:" r={customer?.doc || s.defaultDoc || '222222222222'} />}
      {customer?.phone && <Row l="Tel:" r={customer.phone} />}
      {s.showChannel !== false && sale.channel && <Row l="Canal:" r={sale.channel === 'Tienda' ? 'Tienda en línea' : sale.channel} />}

      {sale.status === 'anulada' && <div className="pt-void">*** DOCUMENTO ANULADO ***</div>}

      <div className="pt-sep" />
      <div className="pt-cols pt-cols--head">
        <span>CANT</span>
        <span>DESCRIPCIÓN</span>
        <span>TOTAL</span>
      </div>
      <div className="pt-sep" />
      {sale.items.map((i, k) => (
        <div key={k} className="pt-item">
          <div className="pt-cols">
            <span>{i.qty}</span>
            <span>{i.name}</span>
            <span>{number(i.qty * i.price)}</span>
          </div>
          <div className="pt-item__meta">
            {[i.sku, i.color, i.size && i.size !== 'Única' ? `T.${i.size}` : null].filter(Boolean).join(' ')} @ {number(i.price)}
          </div>
        </div>
      ))}
      <div className="pt-sep" />

      <Row l="SUBTOTAL" r={number(sale.subtotal)} />
      {sale.discount > 0 && <Row l="DESCUENTO" r={`-${number(sale.discount)}`} />}
      <Row l={`IVA ${s.taxRate || 0}%`} r={number(sale.tax || 0)} />
      <div className="pt-sep pt-sep--double" />
      <Row l="TOTAL A PAGAR" r={money(sale.total)} strong big />
      <div className="pt-sep pt-sep--double" />

      <div className="pt-strong">FORMA DE PAGO</div>
      {sale.payments.map((p, k) => (
        <Row key={k} l={PAYMENT_METHODS.find((m) => m.id === p.method)?.name || p.method} r={number(p.amount)} />
      ))}
      {sale.change > 0 && (
        <>
          <Row l="Efectivo recibido" r={number(sale.received)} />
          <Row l="CAMBIO" r={number(sale.change)} strong />
        </>
      )}
      <div className="pt-sep" />
      <Row l="Total artículos:" r={units} />
      {sale.discount > 0 && <Row l="Usted ahorró:" r={money(sale.discount)} />}

      {s.showBarcode !== false && (
        <div className="pt-center pt-barcode-wrap">
          <Barcode value={no} />
          <div className="pt-small">{no}</div>
        </div>
      )}

      {s.receiptFooter && (
        <>
          <div className="pt-sep" />
          <p className="pt-center pt-small pt-foot">{s.receiptFooter}</p>
        </>
      )}
      <div className="pt-sep" />
      {s.invoiceThanks !== '' && <div className="pt-center pt-strong">{s.invoiceThanks ?? '¡GRACIAS POR SU COMPRA!'}</div>}
      {s.showPrintedAt !== false && <div className="pt-center pt-small">Impreso: {fmtDate(new Date(), { day: '2-digit', month: '2-digit', year: 'numeric' })} {fmtTime(new Date())}</div>}
      {s.invoiceSignature !== '' && <div className="pt-center pt-small">{s.invoiceSignature ?? 'MOSS · Tienda en línea'}</div>}
    </div>
  )
}

// Muestra la factura completa de una vez: la escala para que quepa en la pantalla sin bajar.
// Un botón permite verla en tamaño real.
export function FitReceipt({ children, reserve = 260, minScale = 0.45 }) {
  const inner = useRef(null)
  const [real, setReal] = useState(false)
  const [fit, setFit] = useState({ scale: 1, height: null })
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const calc = () => {
      const natural = el.offsetHeight
      const avail = Math.max(300, window.innerHeight - reserve)
      const scale = real ? 1 : Math.max(minScale, Math.min(1, avail / natural))
      setFit({ scale, height: Math.ceil(natural * scale) })
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    window.addEventListener('resize', calc)
    return () => { ro.disconnect(); window.removeEventListener('resize', calc) }
  }, [reserve, minScale, real])
  const scaled = fit.scale < 0.999
  return (
    <div className="receipt-fit">
      <div className="receipt-fit__box" style={{ height: fit.height ?? 'auto' }}>
        <div ref={inner} className="receipt-fit__inner" style={{ transform: `scale(${fit.scale})` }}>{children}</div>
      </div>
      {(scaled || real) && (
        <button type="button" className="receipt-fit__zoom" onClick={() => setReal((r) => !r)}>
          {real ? <><Minimize2 size={14} /> Ver completa</> : <><Maximize2 size={14} /> Tamaño real</>}
        </button>
      )}
    </div>
  )
}

export function printReceipt() {
  window.print()
}

export default function ReceiptModal({ sale, onClose, title = 'Factura de venta', closeLabel = 'Cerrar' }) {
  const { settings, customerMap } = useApp()
  const success = title.startsWith('¡')
  const voided = sale.status === 'anulada'
  const customer = sale.customerId ? customerMap[sale.customerId] : null
  const units = sale.items.reduce((a, i) => a + i.qty, 0)
  const methods = sale.payments.map((p) => PAYMENT_METHODS.find((m) => m.id === p.method)?.name || p.method).join(' + ')

  return (
    <Modal
      title={title}
      subtitle={`${invoiceNo(settings, sale.number)} · Papel ${settings.paperWidth || '80'} mm`}
      onClose={onClose}
      size="receipt"
      icon={voided ? Ban : success ? CheckCircle2 : ReceiptIcon}
      tone={voided ? 'danger' : success ? 'success' : 'accent'}
      badge={voided ? 'Anulada' : sale.status === 'pendiente' ? 'Pedido pendiente' : 'Factura'}
      footer={
        <>
          <button className="btn btn--secondary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </button>
          <button className="btn btn--primary" onClick={onClose} autoFocus>{closeLabel}</button>
        </>
      }
    >
      <div className="receipt-view">
        <div className="receipt-side">
          <div className="receipt-summary">
            <div><span>Factura</span><strong className="mono">{invoiceNo(settings, sale.number)}</strong></div>
            <div><span>Fecha</span><strong>{fmtDate(sale.date, { day: 'numeric', month: 'short', year: 'numeric' })} · {fmtTime(sale.date)}</strong></div>
            <div><span>Cliente</span><strong>{customer?.name || 'Consumidor final'}</strong></div>
            <div><span>Forma de pago</span><strong>{methods}</strong></div>
            <div><span>Artículos</span><strong>{units}</strong></div>
            {sale.discount > 0 && <div className="receipt-summary__accent"><span>Descuento</span><strong>−{money(sale.discount)}</strong></div>}
            <div className="receipt-summary__total"><span>Total pagado</span><strong>{money(sale.total)}</strong></div>
            {sale.change > 0 && <div><span>Cambio entregado</span><strong>{money(sale.change)}</strong></div>}
          </div>
          <p className="receipt-tip">
            <Printer size={14} /> Pulsa Imprimir para guardar o imprimir el comprobante.
          </p>
        </div>
        <div className="receipt-frame">
          <FitReceipt reserve={400}>
            <div className="receipt-paper">
              <ReceiptContent sale={sale} />
            </div>
          </FitReceipt>
        </div>
      </div>
      {createPortal(
        <div className={`print-area print-area--${settings.paperWidth || '80'}`}>
          <style>{`@media print { @page { size: ${settings.paperWidth || '80'}mm auto; margin: 0; } }`}</style>
          <ReceiptContent sale={sale} />
        </div>,
        document.body
      )}
    </Modal>
  )
}
