import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight, AtSign, Bell, Check, ChevronRight, EyeOff, IdCard, Lock, Mail, UserRound, CheckCircle2, ClipboardList, CreditCard, LayoutGrid, LogIn, LogOut, MapPin, Menu, MessageCircle, Minus, Moon, Package, Palette, Phone, Plus,
  Eye, ReceiptText, RefreshCcw, Ruler, Search, ShieldCheck, ShoppingBag, ShoppingCart, Sparkles, Store, Sun, Trash2, Truck, UserPlus, Wallet, X, Clock, XCircle,
} from 'lucide-react'
import { useApp, stockOf, variantLabel } from '../context/AppContext'
import { CATEGORIES, COLORS, PAYMENT_METHODS } from '../lib/seed'
import { fmtDate, fmtDateTime, fmtTime, money, normalize } from '../lib/format'
import { Avatar, Badge, Drawer, Empty, Field, Modal, Pager, Segmented, Stat, Thumb, usePaged } from '../components/ui'
import ReceiptModal, { invoiceNo } from '../components/Receipt'

function waLink(phone, text) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.length === 10) digits = `57${digits}`
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return digits ? `https://wa.me/${digits}${q}` : `https://web.whatsapp.com/${q}`
}
const igLink = (handle) => `https://instagram.com/${String(handle || '').replace(/^@/, '')}`
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

const ORDER_STATUS = {
  pendiente: ['warning', 'Pendiente de confirmar', Clock],
  completada: ['success', 'Confirmado', CheckCircle2],
  anulada: ['danger', 'Cancelado', XCircle],
}
const PAY_TONE = { efectivo: 'green', transferencia: 'blue', nequi: 'violet', daviplata: 'red' }
const SECTIONS = [['catalogo', 'Catálogo', LayoutGrid], ['nosotros', 'Compra con nosotros', ShieldCheck, 'Nosotros'], ['contacto', 'Contacto', MessageCircle]]
const ONLINE_METHODS = ['transferencia', 'nequi', 'daviplata', 'efectivo']
const METHOD_HINT = { efectivo: 'Pago contra entrega', transferencia: 'Te enviamos los datos', nequi: 'Te enviamos el número', daviplata: 'Te enviamos el número' }

// ---------------- Detalle de producto ----------------
function ProductModal({ product, settings, canBuy, inCart, onAdd, onClose }) {
  const navigate = useNavigate()
  const colors = [...new Set(product.variants.map((v) => v.color))]
  const [color, setColor] = useState(colors.find((c) => product.variants.some((v) => v.color === c && v.stock > 0)) || colors[0])
  const sizes = product.variants.filter((v) => v.color === color)
  const [size, setSize] = useState(sizes.find((v) => v.stock > 0)?.size || sizes[0]?.size)
  const [qty, setQty] = useState(1)
  const chosen = sizes.find((v) => v.size === size)
  const left = chosen ? chosen.stock - (inCart[chosen.id] || 0) : 0
  const available = left > 0
  const name = `${product.type} ${product.name}`
  const message = `Hola ${settings.storeName}, me interesa ${name} (${product.sku}) en color ${color}${size && size !== 'Única' ? `, talla ${size}` : ''}. ¿Está disponible?`

  useEffect(() => setQty(1), [color, size])

  return (
    <Modal icon={ShoppingBag} badge={money(product.price)} title={name} subtitle={`${product.sku} · Elige color y talla`} onClose={onClose} size="md">
      <div className="sf-product">
        <div className="sf-product__img"><img src={product.image} alt={name} /></div>
        <div className="sf-product__body">
          <span className="field__label"><Palette size={14} /> Color</span>
          <div className="sf-options">
            {colors.map((c) => {
              const st = product.variants.filter((v) => v.color === c).reduce((a, v) => a + v.stock, 0)
              return (
                <button
                  key={c}
                  type="button"
                  className={`color-opt ${color === c ? 'is-active' : ''}`}
                  onClick={() => {
                    setColor(c)
                    const first = product.variants.find((v) => v.color === c && v.stock > 0) || product.variants.find((v) => v.color === c)
                    setSize(first?.size)
                  }}
                >
                  <span className="swatch" style={{ background: COLORS[c] || '#ccc' }} /> {c}
                  {st === 0 && <small>Agotado</small>}
                </button>
              )
            })}
          </div>
          <span className="field__label"><Ruler size={14} /> Talla</span>
          <div className="sf-options">
            {sizes.map((v) => (
              <button key={v.id} type="button" className={`sf-size ${size === v.size ? 'is-active' : ''}`} disabled={v.stock === 0} onClick={() => setSize(v.size)}>
                {v.size}
              </button>
            ))}
          </div>
          <div className={`sf-stock ${available ? (left <= product.minStock ? 'is-low' : 'is-ok') : ''}`}>
            {available ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {available ? (left <= product.minStock ? `¡Últimas ${left} unidades!` : 'Disponible para entrega') : chosen?.stock > 0 ? 'Ya tienes todas las unidades en tu carrito' : 'Agotado en esta combinación'}
          </div>
          {canBuy ? (
            <>
              <div className="sf-buy">
                <div className="stepper">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Restar"><Minus size={14} /></button>
                  <input value={qty} readOnly aria-label="Cantidad" />
                  <button type="button" onClick={() => setQty((q) => Math.min(left, q + 1))} disabled={qty >= left} aria-label="Sumar"><Plus size={14} /></button>
                </div>
                <button type="button" className="btn btn--primary btn--lg" disabled={!available} onClick={() => onAdd(product, chosen, qty)}>
                  <ShoppingCart size={18} /> Agregar al carrito
                </button>
              </div>
              <a className="btn btn--secondary btn--block" href={waLink(settings.phone, message)} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Preguntar por WhatsApp</a>
            </>
          ) : (
            <div className="sf-gate">
              <p><strong>Para comprar, entra a tu cuenta.</strong> Así guardamos tu pedido y te avisamos cuando esté confirmado.</p>
              <div className="sf-gate__actions">
                <button type="button" className="btn btn--primary" onClick={() => navigate('/registro')}><UserPlus size={16} /> Crear cuenta</button>
                <button type="button" className="btn btn--secondary" onClick={() => navigate('/login')}><LogIn size={16} /> Iniciar sesión</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ---------------- Carrito ----------------
function CartDrawer({ cart, setQty, remove, onCheckout, onClose }) {
  const subtotal = cart.reduce((a, l) => a + l.qty * l.price, 0)
  const units = cart.reduce((a, l) => a + l.qty, 0)
  return (
    <Drawer
      icon={ShoppingCart}
      badge={`${units} ${units === 1 ? 'artículo' : 'artículos'}`}
      title="Tu carrito"
      subtitle="Revisa tus prendas antes de finalizar"
      onClose={onClose}
      footer={
        <div className="sf-cart-foot">
          <div><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <button className="btn btn--primary btn--lg" disabled={!cart.length} onClick={onCheckout}>Finalizar compra <ArrowRight size={18} /></button>
        </div>
      }
    >
      {cart.length ? (
        <div className="sf-cart">
          {cart.map((l) => (
            <div key={l.variantId} className="tline">
              <Thumb src={l.image} size={56} />
              <div className="tline__info">
                <strong>{l.name}</strong>
                <span className="text-muted">{variantLabel(l)} · {money(l.price)}</span>
                <div className="tline__row">
                  <div className="stepper">
                    <button onClick={() => (l.qty === 1 ? remove(l.variantId) : setQty(l.variantId, l.qty - 1))} aria-label="Restar"><Minus size={14} /></button>
                    <input value={l.qty} readOnly aria-label="Cantidad" />
                    <button onClick={() => setQty(l.variantId, l.qty + 1)} disabled={l.qty >= l.max} aria-label="Sumar"><Plus size={14} /></button>
                  </div>
                  <strong>{money(l.qty * l.price)}</strong>
                </div>
              </div>
              <button className="btn-icon btn-icon--sm tline__del" onClick={() => remove(l.variantId)} aria-label="Quitar"><X size={14} /></button>
            </div>
          ))}
        </div>
      ) : (
        <Empty icon={ShoppingCart} title="Tu carrito está vacío" text="Explora el catálogo y agrega tus prendas favoritas." />
      )}
    </Drawer>
  )
}

// ---------------- Finalizar compra ----------------
function CheckoutModal({ cart, customer, settings, onPlace, onClose }) {
  const [delivery, setDelivery] = useState('envio')
  const [method, setMethod] = useState('transferencia')
  const [f, setF] = useState({ phone: customer?.phone || '', address: customer?.address || '', city: customer?.city || '', note: '' })
  const [err, setErr] = useState('')
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: e.target.value })); setErr('') }
  const subtotal = cart.reduce((a, l) => a + l.qty * l.price, 0)
  const tax = Math.round(subtotal * ((settings.taxRate || 0) / 100))
  const total = subtotal + tax

  const submit = () => {
    if (f.phone.replace(/\D/g, '').length < 7) return setErr('Escribe un celular para confirmar tu pedido.')
    if (delivery === 'envio' && f.address.trim().length < 5) return setErr('Escribe la dirección de entrega.')
    onPlace({ delivery, method, ...f })
  }

  return (
    <Modal
      icon={CreditCard}
      badge="Pedido en línea"
      title="Finalizar compra"
      subtitle="Confirma tus datos de entrega y el medio de pago"
      onClose={onClose}
      size="md"
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Volver</button>
          <button className="btn btn--primary btn--lg" onClick={submit}><Check size={18} /> Confirmar pedido · {money(total)}</button>
        </>
      }
    >
      <div className="pay">
        <div className="pay__total">
          <span className="pay__total-icon"><ShoppingBag size={22} /></span>
          <div>
            <span>Total del pedido</span>
            <strong>{money(total)}</strong>
          </div>
          <span className="hero__pill">{cart.reduce((a, l) => a + l.qty, 0)} artículos</span>
        </div>

        <Segmented value={delivery} onChange={setDelivery} options={[['envio', 'Envío a domicilio'], ['tienda', 'Recoger en tienda']]} />

        <div className="form-grid">
          <Field label="Celular / WhatsApp"><input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="300 000 0000" /></Field>
          <Field label="Ciudad"><input className="input" value={f.city} onChange={set('city')} placeholder={delivery === 'envio' ? 'Ciudad de entrega' : 'Opcional'} /></Field>
          {delivery === 'envio' && <Field label="Dirección de entrega" full><input className="input" value={f.address} onChange={set('address')} placeholder="Calle, número, barrio, apto…" /></Field>}
          <Field label="Nota para la tienda" full><input className="input" value={f.note} onChange={set('note')} placeholder="Opcional: horario de entrega, referencia…" /></Field>
        </div>

        <span className="field__label">Medio de pago</span>
        <div className="pay__methods sf-methods">
          {PAYMENT_METHODS.filter((m) => ONLINE_METHODS.includes(m.id)).map((m) => (
            <button key={m.id} type="button" className={`pay__method pay__method--${m.id} ${method === m.id ? 'is-active' : ''}`} onClick={() => setMethod(m.id)}>
              <span className="pay__method-icon">{m.id === 'efectivo' ? <Truck size={20} /> : <CreditCard size={20} />}</span>
              {m.id === 'efectivo' ? 'Contra entrega' : m.name}
              <small>{METHOD_HINT[m.id]}</small>
              {method === m.id && <span className="pay__method-check"><Check size={12} strokeWidth={3} /></span>}
            </button>
          ))}
        </div>
        <p className="pay__note">
          Tu pedido queda <b>apartado</b> y la tienda lo confirma por WhatsApp. {method === 'efectivo' ? 'Pagas al recibir.' : 'Te enviaremos los datos para el pago.'}
        </p>
        {err && <div className="alert alert--danger">{err}</div>}
      </div>
    </Modal>
  )
}

// ---------------- Mis pedidos ----------------
const ORDER_FILTERS = [['all', 'Todos'], ['pendiente', 'Por confirmar'], ['completada', 'Confirmados'], ['anulada', 'Cancelados']]
const ORDER_STEPS = ['Recibido', 'En revisión', 'Confirmado']

function OrderCard({ o, settings, productMap, onInvoice }) {
  const [tone, label, StatusIcon] = ORDER_STATUS[o.status] || ORDER_STATUS.completada
  const step = o.status === 'completada' ? 3 : o.status === 'pendiente' ? 2 : 0
  const units = o.items.reduce((a, i) => a + i.qty, 0)
  const [delivery, ...extra] = (o.note || '').split(' · ')
  return (
    <article className={`sf-order sf-order--${o.status}`}>
      <div className="sf-order__head">
        <span className={`sf-order__icon ic--${tone}`}><StatusIcon size={18} /></span>
        <div>
          <strong>{invoiceNo(settings, o.number)}</strong>
          <span>{fmtDateTime(o.date)} · {units} {units === 1 ? 'artículo' : 'artículos'}</span>
        </div>
        <Badge tone={tone} dot>{label}</Badge>
      </div>

      {o.status === 'anulada' ? (
        <div className="sf-order__cancel"><XCircle size={16} /> La tienda canceló este pedido y las prendas volvieron al inventario.</div>
      ) : (
        <ol className="sf-steps" aria-label="Estado del pedido">
          {ORDER_STEPS.map((st, k) => (
            <li key={st} className={k === step - 1 && o.status === 'pendiente' ? 'is-current' : k < step ? 'is-done' : ''}>
              <span>{k === step - 1 && o.status === 'pendiente' ? <Clock size={12} strokeWidth={3} /> : k < step ? <Check size={12} strokeWidth={3} /> : k + 1}</span>{st}
            </li>
          ))}
        </ol>
      )}

      <ul className="sf-order__items">
        {o.items.map((i, k) => (
          <li key={k}>
            <Thumb src={i.image || productMap[i.productId]?.image} size={44} />
            <div><strong>{i.qty} × {i.name}</strong><small>{[i.color, i.size && i.size !== 'Única' ? `Talla ${i.size}` : null].filter(Boolean).join(' · ')}</small></div>
            <b>{money(i.qty * i.price)}</b>
          </li>
        ))}
      </ul>

      {delivery && (
        <div className="sf-order__info">
          <Truck size={15} />
          <span>{delivery}{extra.length > 0 && <small>{extra.join(' · ')}</small>}</span>
        </div>
      )}

      <div className="sf-order__foot">
        <div><span>Total</span><strong>{money(o.total)}</strong></div>
        <button type="button" className="btn btn--secondary btn--sm" onClick={() => onInvoice(o)}><ReceiptText size={15} /> Ver factura</button>
        {o.status === 'pendiente' && (
          <a className="btn btn--primary btn--sm" href={waLink(settings.phone, `Hola ${settings.storeName}, quiero saber el estado de mi pedido ${invoiceNo(settings, o.number)}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Preguntar</a>
        )}
      </div>
    </article>
  )
}

// Módulo "Mis pedidos": banner, resumen, búsqueda, filtros y tarjetas con el avance de cada pedido.
function OrdersPage({ orders, settings, productMap, onInvoice, onShop, onInvoices }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const n = normalize(q)
  const rows = orders.filter((o) => (filter === 'all' || o.status === filter)
    && (!n || normalize(`${invoiceNo(settings, o.number)} ${o.items.map((i) => i.name).join(' ')}`).includes(n)))
  const count = (st) => orders.filter((o) => o.status === st).length
  const live = orders.filter((o) => o.status !== 'anulada')
  const units = live.reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty, 0), 0)
  const last = orders[0]
  const pg = usePaged(rows, 6)
  return (
    <>
      <section className="hero hero--report">
        <div className="hero__copy">
          <span className="hero__eyebrow"><ClipboardList size={14} /> Mis pedidos · {orders.length} {orders.length === 1 ? 'pedido' : 'pedidos'}</span>
          <span className="hero__kicker">Total de tus pedidos activos</span>
          <h1 className="hero__amount">{money(live.reduce((a, o) => a + o.total, 0))}</h1>
          <div className="hero__pills">
            <span className="hero__pill sf-pill--amber"><i /> {count('pendiente')} por confirmar</span>
            <span className="hero__pill hero__pill--ok"><i /> {count('completada')} confirmado{count('completada') === 1 ? '' : 's'}</span>
          </div>
          <div className="hero__actions">
            <button className="btn btn--primary btn--lg" onClick={onShop}><ShoppingBag size={18} /> Seguir comprando</button>
            <button className="btn btn--glass btn--lg" onClick={onInvoices}><ReceiptText size={18} /> Mis facturas</button>
          </div>
        </div>
        <div className="hero__visual hero__visual--report">
          <div className="hero__visual-head"><strong>Resumen de pedidos</strong></div>
          <div className="hero__tiles hero__tiles--grid">
            <div className="hero__tile"><ClipboardList size={16} /><strong>{orders.length}</strong><span>Pedidos</span></div>
            <div className="hero__tile"><Package size={16} /><strong>{units}</strong><span>Prendas</span></div>
            <div className="hero__tile"><Clock size={16} /><strong>{count('pendiente')}</strong><span>En revisión</span></div>
            <div className="hero__tile"><Truck size={16} /><strong>{last ? fmtDate(last.date, { day: 'numeric', month: 'short' }) : '—'}</strong><span>Último pedido</span></div>
          </div>
        </div>
      </section>

      <section className="card card--flush store__orders" id="pedidos">
        <div className="toolbar">
          <div className="input-icon toolbar__search">
            <Search size={16} />
            <input className="input" placeholder="Buscar por N° de pedido o prenda…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented value={filter} onChange={setFilter} options={ORDER_FILTERS} />
        </div>
        {rows.length ? (
          <>
            <div className="sf-orders-grid">
              {pg.rows.map((o) => <OrderCard key={o.id} o={o} settings={settings} productMap={productMap} onInvoice={onInvoice} />)}
            </div>
            <Pager pg={pg} noun="pedidos" />
          </>
        ) : (
          <Empty
            icon={ClipboardList}
            title={orders.length ? 'No hay pedidos con estos filtros' : 'Aún no tienes pedidos'}
            text={orders.length ? 'Prueba con otra búsqueda o estado.' : 'Cuando compres, aquí verás el estado de cada pedido.'}
            action={!orders.length && <button className="btn btn--primary" onClick={onShop}><ShoppingBag size={16} /> Ir al catálogo</button>}
          />
        )}
      </section>
    </>
  )
}

// ---------------- Notificaciones del cliente ----------------
const ago = (iso) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ayer' : d < 7 ? `hace ${d} días` : fmtDate(iso, { day: 'numeric', month: 'short' })
}
// Cada cambio de un pedido es una notificación: recibido, confirmado o cancelado.
const orderEvents = (orders, settings) => orders.flatMap((o) => {
  const no = invoiceNo(settings, o.number)
  const ev = [{ id: `${o.id}-r`, at: o.date, tone: 'amber', icon: Clock, title: 'Recibimos tu pedido', text: `${no} · ${money(o.total)} · la tienda lo está revisando` }]
  if (o.confirmedAt) ev.push({ id: `${o.id}-c`, at: o.confirmedAt, tone: 'green', icon: CheckCircle2, title: '¡Tu pedido fue confirmado!', text: `${no} · ya puedes ver tu factura` })
  if (o.voidedAt) ev.push({ id: `${o.id}-x`, at: o.voidedAt, tone: 'red', icon: XCircle, title: 'Tu pedido fue cancelado', text: `${no} · ${o.voidReason || 'las prendas volvieron al inventario'}` })
  return ev
}).sort((a, b) => new Date(b.at) - new Date(a.at))

function ClientNotifications({ orders, settings, seenAt, onGo, onClose }) {
  const events = orderEvents(orders, settings)
  const fresh = events.filter((e) => new Date(e.at) > new Date(seenAt || 0))
  const old = events.filter((e) => !fresh.includes(e))
  const count = (st) => orders.filter((o) => o.status === st).length
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
  const item = (e, isNew) => (
    <li key={e.id}>
      <button type="button" onClick={() => onGo(e.icon === CheckCircle2 ? 'facturas' : 'pedidos')}>
        <span className={`notif-list__icon ic--${e.tone}`}><e.icon size={17} /></span>
        <div>
          <strong>{e.title}</strong>
          <span className="notif-list__text">{e.text}</span>
          <small className="notif-list__time">{ago(e.at)}{isNew && <b className="notif-new">Nuevo</b>}</small>
        </div>
        <ChevronRight size={16} className="notif-list__go" />
      </button>
    </li>
  )
  return createPortal(
    <>
      <div className="notif-scrim" onClick={onClose} />
      <aside className="notif-panel" role="dialog" aria-label="Notificaciones">
        <div className="notif-panel__head">
          <span className="notif-panel__icon"><Bell size={20} /></span>
          <div>
            <strong>Notificaciones</strong>
            <span>{fresh.length ? `${fresh.length} sin leer` : 'Estás al día'}</span>
          </div>
          <button className="btn-icon btn-icon--sm" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        </div>
        <div className="notif-panel__body">
          <div className="notif-panel__chips">
            <span className="notif-chip ic--amber"><Clock size={14} /> {count('pendiente')} en revisión</span>
            <span className="notif-chip ic--green"><CheckCircle2 size={14} /> {count('completada')} confirmado{count('completada') === 1 ? '' : 's'}</span>
            <span className="notif-chip ic--red"><XCircle size={14} /> {count('anulada')} cancelado{count('anulada') === 1 ? '' : 's'}</span>
          </div>
          {events.length === 0 ? (
            <div className="notif-panel__empty notif-panel__empty--big">
              <span className="notif-list__icon ic--blue"><ShoppingBag size={18} /></span>
              <strong>Aún no tienes notificaciones</strong>
              <span>Cuando hagas un pedido, aquí te avisamos cada vez que cambie de estado.</span>
              <button className="btn btn--primary btn--sm" onClick={() => onGo('catalogo')}><ShoppingBag size={15} /> Ir al catálogo</button>
            </div>
          ) : (
            <>
              {fresh.length > 0 && (
                <section>
                  <h4 className="notif-panel__label">Nuevas</h4>
                  <ul className="notif-list">{fresh.map((e) => item(e, true))}</ul>
                </section>
              )}
              {old.length > 0 && (
                <section>
                  <h4 className="notif-panel__label">{fresh.length ? 'Anteriores' : 'Recientes'}</h4>
                  <ul className="notif-list">{old.map((e) => item(e, false))}</ul>
                </section>
              )}
            </>
          )}
        </div>
        <div className="notif-panel__foot">
          <button className="btn btn--secondary" onClick={() => onGo('pedidos')}><ClipboardList size={16} /> Mis pedidos</button>
          <button className="btn btn--primary" onClick={() => onGo('facturas')}><ReceiptText size={16} /> Mis facturas</button>
        </div>
      </aside>
    </>,
    document.body,
  )
}

// ---------------- Mi perfil (solo la clienta ve y edita su cédula) ----------------
function ProfilePage({ user, customer, orders, onSave }) {
  const init = () => ({ name: customer?.name || user.name || '', doc: customer?.doc || '', phone: customer?.phone || '', email: customer?.email || '', city: customer?.city || '', address: customer?.address || '' })
  const [f, setF] = useState(init)
  const [showDoc, setShowDoc] = useState(false)
  const [err, setErr] = useState('')
  useEffect(() => { setF(init()) }, [customer?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => { setF((x) => ({ ...x, [k]: k === 'doc' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value })); setErr('') }
  const saved = init()
  const dirty = JSON.stringify(f) !== JSON.stringify(saved)
  const masked = f.doc ? `${'•'.repeat(Math.max(0, f.doc.length - 3))}${f.doc.slice(-3)}` : 'Sin registrar'
  const [saving, setSaving] = useState(false)
  const validate = (v) => {
    if (v.name.trim().length < 3) return 'Escribe tu nombre completo.'
    if (!/^\d{6,10}$/.test(v.doc)) return 'Escribe tu número de cédula (6 a 10 dígitos).'
    if (v.phone.replace(/\D/g, '').length < 7) return 'Escribe un celular válido.'
    if (v.email && !/^\S+@\S+\.\S+$/.test(v.email)) return 'El correo no es válido.'
    return ''
  }
  // Guardado automático: al dejar de escribir se revisan los datos y, si están bien, se guardan solos.
  const lastSent = useRef('')
  const save = async (v) => {
    const msg = validate(v)
    if (msg) return setErr(msg)
    const key = JSON.stringify(v)
    if (key === lastSent.current) return
    lastSent.current = key
    setSaving(true)
    const r = await onSave(v)
    setSaving(false)
    if (r?.error) { setErr(r.error); lastSent.current = '' }
  }
  useEffect(() => {
    if (!dirty) return
    const t = setTimeout(() => save(f), 900)
    return () => clearTimeout(t)
  }, [f, dirty]) // eslint-disable-line react-hooks/exhaustive-deps
  const submit = (e) => { e.preventDefault(); if (dirty) save(f) }
  const paid = orders.filter((o) => o.status === 'completada')
  return (
    <>
      <section className="hero hero--report">
        <div className="hero__copy">
          <span className="hero__eyebrow"><UserRound size={14} /> Mi perfil · Cuenta de cliente</span>
          <span className="hero__kicker">Tus datos personales</span>
          <h1 className="hero__amount hero__amount--name">{f.name || user.name}</h1>
          <div className="hero__pills">
            <span className={`hero__pill ${saved.doc ? 'hero__pill--ok' : 'sf-pill--amber'}`}><i /> {saved.doc ? 'Cédula registrada' : 'Falta tu cédula'}</span>
            <span className="hero__pill"><Lock size={14} /> Solo tú puedes ver y editar estos datos</span>
          </div>
        </div>
        <div className="hero__visual hero__visual--report">
          <div className="hero__visual-head"><strong>Tu cuenta</strong></div>
          <div className="hero__tiles hero__tiles--grid">
            <div className="hero__tile"><IdCard size={16} /><strong>{saved.doc ? `•••${saved.doc.slice(-3)}` : '—'}</strong><span>Cédula</span></div>
            <div className="hero__tile"><ClipboardList size={16} /><strong>{orders.length}</strong><span>Pedidos</span></div>
            <div className="hero__tile"><ReceiptText size={16} /><strong>{paid.length}</strong><span>Facturas pagadas</span></div>
            <div className="hero__tile"><UserRound size={16} /><strong>{user.username}</strong><span>Usuario</span></div>
          </div>
        </div>
      </section>

      <form className="card store__profile" id="perfil" onSubmit={submit}>
        <div className="card__head">
          <div className="card__title-icon ic--blue"><IdCard size={20} /></div>
          <div><h3>Datos personales</h3><p>Se usan en tus facturas y para coordinar tus entregas</p></div>
        </div>
        <div className="form-grid">
          <Field label="Nombre completo" full>
            <input className="input" value={f.name} onChange={set('name')} autoComplete="name" />
          </Field>
          <Field label="Número de cédula" hint="Aparece en tus facturas. Nadie más puede cambiarla.">
            <div className="input-icon">
              <IdCard size={17} />
              <input className="input mono" value={showDoc ? f.doc : masked} onChange={set('doc')} onFocus={() => setShowDoc(true)} inputMode="numeric" autoComplete="off" placeholder="Tu número de cédula" />
              <button type="button" className="input-icon__end" onClick={() => setShowDoc((v) => !v)} aria-label={showDoc ? 'Ocultar cédula' : 'Ver cédula'} title={showDoc ? 'Ocultar' : 'Ver'}>
                {showDoc ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </Field>
          <Field label="Celular / WhatsApp">
            <div className="input-icon"><Phone size={17} /><input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" /></div>
          </Field>
          <Field label="Correo">
            <div className="input-icon"><Mail size={17} /><input className="input" type="email" value={f.email} onChange={set('email')} autoComplete="email" placeholder="Opcional" /></div>
          </Field>
          <Field label="Ciudad">
            <div className="input-icon"><MapPin size={17} /><input className="input" value={f.city} onChange={set('city')} autoComplete="address-level2" placeholder="Opcional" /></div>
          </Field>
          <Field label="Dirección de entrega" full>
            <div className="input-icon"><Truck size={17} /><input className="input" value={f.address} onChange={set('address')} autoComplete="street-address" placeholder="Calle, número, barrio, apto…" /></div>
          </Field>
        </div>
        {err && <div className="alert alert--danger">{err}</div>}
        <p className={`autosave ${err ? 'is-error' : dirty || saving ? 'is-saving' : 'is-ok'}`}>
          <i /> {err ? 'Sin guardar: corrige el dato marcado arriba' : dirty || saving ? 'Guardando…' : 'Tus cambios se guardan automáticamente'}
        </p>
      </form>
    </>
  )
}

// ---------------- Mis facturas (módulo) ----------------
const INV_FILTERS = [['all', 'Todas'], ['completada', 'Pagadas'], ['pendiente', 'Por confirmar'], ['anulada', 'Canceladas']]
function InvoicesPage({ orders, settings, onOpen, onShop, onOrders }) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const n = normalize(q)
  const rows = orders.filter((o) => (filter === 'all' || o.status === filter)
    && (!n || normalize(`${invoiceNo(settings, o.number)} ${o.items.map((i) => i.name).join(' ')}`).includes(n)))
  const paid = orders.filter((o) => o.status === 'completada')
  const paidTotal = paid.reduce((a, o) => a + o.total, 0)
  const pending = orders.filter((o) => o.status === 'pendiente').length
  const units = paid.reduce((a, o) => a + o.items.reduce((x, i) => x + i.qty, 0), 0)
  const methodName = (id) => (id === 'efectivo' ? 'Contra entrega' : PAYMENT_METHODS.find((m) => m.id === id)?.name || id)
  const pg = usePaged(rows)
  return (
    <>
      <section className="hero hero--report">
        <div className="hero__copy">
          <span className="hero__eyebrow"><ReceiptText size={14} /> Mis facturas · {orders.length} {orders.length === 1 ? 'documento' : 'documentos'}</span>
          <span className="hero__kicker">Total pagado en facturas confirmadas</span>
          <h1 className="hero__amount">{money(paidTotal)}</h1>
          <div className="hero__pills">
            <span className="hero__pill hero__pill--ok"><i /> {paid.length} pagada{paid.length === 1 ? '' : 's'}</span>
            <span className="hero__pill sf-pill--amber"><i /> {pending} por confirmar</span>
          </div>
          <div className="hero__actions">
            <button className="btn btn--primary btn--lg" onClick={onShop}><ShoppingBag size={18} /> Seguir comprando</button>
            <button className="btn btn--glass btn--lg" onClick={onOrders}><ClipboardList size={18} /> Mis pedidos</button>
          </div>
        </div>
        <div className="hero__visual hero__visual--report">
          <div className="hero__visual-head"><strong>Resumen de compras</strong></div>
          <div className="hero__tiles hero__tiles--grid">
            <div className="hero__tile"><ReceiptText size={16} /><strong>{orders.length}</strong><span>Facturas</span></div>
            <div className="hero__tile"><Clock size={16} /><strong>{pending}</strong><span>Por confirmar</span></div>
            <div className="hero__tile"><Package size={16} /><strong>{units}</strong><span>Prendas compradas</span></div>
          </div>
        </div>
      </section>

      <section className="card card--flush store__invoices" id="facturas">
        <div className="toolbar">
          <div className="input-icon toolbar__search">
            <Search size={16} />
            <input className="input" placeholder="Buscar por N° de factura o prenda…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Segmented value={filter} onChange={setFilter} options={INV_FILTERS} />
        </div>
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>N° factura</th>
                  <th>Fecha</th>
                  <th className="num">Art.</th>
                  <th>Pago</th>
                  <th>Entrega</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                  <th className="num">Factura</th>
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((o) => {
                  const [tone, label] = ORDER_STATUS[o.status] || ORDER_STATUS.completada
                  return (
                    <tr key={o.id}>
                      <td className="mono">{invoiceNo(settings, o.number)}</td>
                      <td><div>{fmtDate(o.date, { day: '2-digit', month: 'short', year: 'numeric' })}</div><span className="text-muted small">{fmtTime(o.date)}</span></td>
                      <td className="num">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                      <td>{o.payments.map((pm) => methodName(pm.method)).join(' + ')}</td>
                      <td>{/Recoge en tienda/i.test(o.note || '') ? 'Recoger en tienda' : 'Domicilio'}</td>
                      <td className={`num strong ${o.status === 'anulada' ? 'strike' : ''}`}>{money(o.total)}</td>
                      <td><Badge tone={tone} dot>{label}</Badge></td>
                      <td className="num"><button type="button" className="btn btn--secondary btn--sm" onClick={() => onOpen(o)}><Eye size={15} /> Ver factura</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <Pager pg={pg} noun="facturas" />
          </div>
        ) : (
          <Empty
            icon={ReceiptText}
            title={orders.length ? 'No hay facturas con estos filtros' : 'Aún no tienes facturas'}
            text={orders.length ? 'Prueba con otra búsqueda o estado.' : 'Cuando hagas tu primer pedido, aquí podrás ver e imprimir su factura.'}
            action={!orders.length && <button className="btn btn--primary" onClick={onShop}><ShoppingBag size={16} /> Ir al catálogo</button>}
          />
        )}
      </section>
    </>
  )
}

// ---------------- Página ----------------
export default function Storefront() {
  const { user, logout, products, productMap, settings, theme, setTheme, sales, customerMap, placeOrder, updateMyProfile, toast, status } = useApp()
  const loadingCatalog = status === 'loading' && !products.length
  const navigate = useNavigate()
  const isClient = user?.role === 'cliente'
  const cartKey = user ? `moss.cart.${user.id}` : null
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [open, setOpen] = useState(null)
  const [panel, setPanel] = useState(null) // 'cart' | 'checkout' | 'orders' | {done: sale}
  const [cart, setCart] = useState(() => {
    try { return cartKey ? JSON.parse(localStorage.getItem(cartKey) || '[]') : [] } catch { return [] }
  })
  useEffect(() => {
    if (!cartKey) return
    try { localStorage.setItem(cartKey, JSON.stringify(cart)) } catch { /* noop */ }
  }, [cart, cartKey])

  // En la tienda solo se muestran prendas activas con unidades disponibles (las agotadas se ocultan).
  const active = useMemo(() => products.filter((p) => p.active && stockOf(p) > 0), [products])
  const list = useMemo(() => {
    const n = normalize(q)
    return active
      .filter((p) => (cat === 'all' || p.category === cat) && (!n || normalize(`${p.sku} ${p.type} ${p.name}`).includes(n)))
  }, [active, q, cat])

  const inCart = useMemo(() => Object.fromEntries(cart.map((l) => [l.variantId, l.qty])), [cart])
  const units = cart.reduce((a, l) => a + l.qty, 0)
  const customer = user?.customerId ? customerMap[user.customerId] : null
  const orders = useMemo(() => (customer ? sales.filter((s) => s.customerId === customer.id) : []), [sales, customer])
  const pendingOrders = orders.filter((o) => o.status === 'pendiente').length

  const inStock = active.length
  const [brandFirst, ...brandRest] = (settings.storeName || 'MOSS').split(' ')
  const firstName = (user?.name || '').split(' ')[0]
  const spent = orders.filter((o) => o.status === 'completada').reduce((a, o) => a + o.total, 0)
  const [section, setSection] = useState('inicio')
  const [menu, setMenu] = useState(false)
  const [notif, setNotif] = useState(null) // null cerrado · { seenAt } abierto
  const seenKey = user ? `moss.notif.seen.${user.id}` : null
  const [seenAt, setSeenAt] = useState(() => { try { return seenKey ? localStorage.getItem(seenKey) || '' : '' } catch { return '' } })
  const unread = useMemo(() => (isClient ? orderEvents(orders, settings).filter((e) => new Date(e.at) > new Date(seenAt || 0)).length : 0), [isClient, orders, settings, seenAt])
  const openNotif = () => {
    setMenu(false)
    setNotif({ seenAt })
    const now = new Date().toISOString()
    setSeenAt(now)
    try { localStorage.setItem(seenKey, now) } catch { /* noop */ }
  }
  const { pathname } = useLocation()
  const view = isClient ? { '/pedidos': 'pedidos', '/facturas': 'facturas', '/perfil': 'perfil' }[pathname] || null : null
  useEffect(() => { window.scrollTo(0, 0) }, [view])
  // Ir a una sección: "Mis pedidos" y "Mis facturas" son módulos aparte; las demás están en el inicio.
  const goSection = (id) => {
    setMenu(false)
    if (id === 'pedidos' || id === 'facturas' || id === 'perfil') return navigate(`/${id}`)
    if (view) { navigate('/'); setTimeout(() => scrollTo(id), 120); return }
    setTimeout(() => scrollTo(id), 50)
  }
  const isOn = (id) => (view ? id === view : section === id)
  const [invoice, setInvoice] = useState(null)
  const ACCOUNT = [['pedidos', 'Mis pedidos', ClipboardList, 'Pedidos'], ['facturas', 'Mis facturas', ReceiptText, 'Facturas']]
  const sections = isClient ? [SECTIONS[0], ...ACCOUNT, ...SECTIONS.slice(1)] : SECTIONS
  useEffect(() => {
    const onScroll = () => {
      let cur = 'inicio'
      for (const id of ['catalogo', 'nosotros', 'contacto']) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top < 160) cur = id
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 4) cur = 'contacto'
      setSection(cur)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const addToCart = (product, variant, qty) => {
    setCart((c) => {
      const found = c.find((l) => l.variantId === variant.id)
      if (found) return c.map((l) => (l.variantId === variant.id ? { ...l, qty: Math.min(variant.stock, l.qty + qty) } : l))
      return [...c, { productId: product.id, variantId: variant.id, sku: product.sku, name: `${product.type} ${product.name}`, image: product.image, color: variant.color, size: variant.size, price: product.price, cost: product.cost, qty, max: variant.stock }]
    })
    setOpen(null)
    toast('Agregado al carrito', 'success', `${product.type} ${product.name} · ${variantLabel(variant)}`)
  }
  const setQty = (variantId, qty) => setCart((c) => c.map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(1, Math.min(l.max, qty)) } : l)))
  const remove = (variantId) => setCart((c) => c.filter((l) => l.variantId !== variantId))

  const [placing, setPlacing] = useState(false)
  const place = async (data) => {
    if (placing) return
    // Revalida el stock actual antes de crear el pedido.
    const short = cart.find((l) => {
      const v = products.find((p) => p.id === l.productId)?.variants.find((x) => x.id === l.variantId)
      return !v || v.stock < l.qty
    })
    if (short) {
      toast('Sin unidades suficientes', 'warning', `${short.name} · ${variantLabel(short)} ya no tiene esa cantidad. Ajusta tu carrito.`)
      setPanel('cart')
      return
    }
    setPlacing(true)
    const r = await placeOrder({ items: cart, ...data })
    setPlacing(false)
    if (r.error) { toast('No se pudo crear el pedido', 'warning', r.error); setPanel('cart'); return }
    const sale = r.sale
    setCart([])
    setPanel({ done: sale })
    toast('Pedido recibido', 'success', `${invoiceNo(settings, sale.number)} · ${money(sale.total)} · pendiente de confirmar`)
  }

  return (
    <div className="store">
      <header className={`store__nav ${isClient ? 'store__nav--client' : ''}`}>
        {/* Celular con sesión iniciada: menú a la izquierda que abre un panel lateral (como en el administrador) */}
        {isClient && (
          <button type="button" className="btn-icon store__menu-btn" onClick={() => setMenu(true)} aria-label="Abrir menú" aria-expanded={menu}>
            <Menu size={20} />
            {pendingOrders > 0 && <span className="btn-icon__dot" />}
          </button>
        )}
        {isClient && (
          <button type="button" className="store__mod" onClick={() => (view ? navigate('/') : scrollTo('inicio'))}>
            <span className="store__mod-icon">{view === 'pedidos' ? <ClipboardList size={20} /> : view === 'facturas' ? <ReceiptText size={20} /> : view === 'perfil' ? <UserRound size={20} /> : <ShoppingBag size={20} strokeWidth={2.2} />}</span>
            <span className="store__mod-text">
              <small>{settings.storeName}</small>
              <strong>{view === 'pedidos' ? 'Mis pedidos' : view === 'facturas' ? 'Mis facturas' : view === 'perfil' ? 'Mi perfil' : 'Inicio'}</strong>
            </span>
          </button>
        )}
        <button type="button" className="store__brand" onClick={() => (view ? navigate('/') : scrollTo('inicio'))}>
          <span className="brand-mark"><ShoppingBag size={20} strokeWidth={2.2} /></span>
          <span className="store__brand-text">
            <strong>{brandFirst} {brandRest.join(' ')}</strong>
            <span>Tienda en línea</span>
          </span>
        </button>
        <nav className="store__links hide-mobile">
          {sections.map(([id, label, Icon, short]) => (
            <button key={id} type="button" className={isOn(id) ? 'is-active' : ''} title={label} onClick={() => goSection(id)}>
              <Icon size={16} /><span className="store__link-full">{label}</span><span className="store__link-short">{short || label}</span>
            </button>
          ))}
        </nav>
        <div className="store__actions">
          <div className="icon-group store__desk">
            <button className="btn-icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Cambiar tema" title="Cambiar tema">
              {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            {isClient && (
              <button className={`btn-icon ${notif ? 'is-active' : ''}`} onClick={openNotif} aria-label="Notificaciones" title="Notificaciones">
                <Bell size={19} />
                {unread > 0 && <span className="btn-icon__dot" />}
              </button>
            )}
          </div>
          {isClient ? (
            <>
              <button className="btn btn--primary store__cart" onClick={() => setPanel('cart')}>
                <ShoppingCart size={18} /> <span className="hide-mobile">Carrito</span>
                {units > 0 && <span className="store__cart-count">{units}</span>}
              </button>
              <button type="button" className={`user-chip store__user store__desk ${view === 'perfil' ? 'is-active' : ''}`} onClick={() => goSection('perfil')} title="Mi perfil">
                <span className="user-chip__avatar"><Avatar name={user.name} size={40} /><i className="user-chip__online" /></span>
                <span className="hide-mobile"><strong>{user.name}</strong><small>Mi perfil</small></span>
              </button>
              <button className="btn btn--danger-ghost store__desk" onClick={logout} title="Cerrar sesión"><LogOut size={16} /> <span className="hide-mobile">Salir</span></button>
            </>
          ) : (
            <>
              <button className="btn btn--secondary store__desk" onClick={() => navigate('/login')}><LogIn size={16} /> Iniciar sesión</button>
              <button className="btn btn--primary store__desk" onClick={() => navigate('/registro')}><UserPlus size={16} /> Crear cuenta</button>
            </>
          )}
          {/* Celular: el cambio de modo va en la barra, solo con el icono */}
          {isClient && (
            <button type="button" className={`btn-icon store__theme-btn store__bell-btn ${notif ? 'is-active' : ''}`} onClick={openNotif} aria-label="Notificaciones" title="Notificaciones">
              <Bell size={19} />
              {unread > 0 && <span className="store__bell-count">{unread > 9 ? '9+' : unread}</span>}
            </button>
          )}
          <button type="button" className="btn-icon store__theme-btn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'} title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}>
            {theme === 'dark' ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          {/* Visitantes: el menú queda a la derecha y se abre como tarjeta debajo de la barra */}
          {!isClient && (
            <button type="button" className="btn-icon store__menu-btn store__menu-btn--right" onClick={() => setMenu((m) => !m)} aria-label="Menú" aria-expanded={menu}>
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </header>

      {menu && (
        <>
          <div className="store__sheet-backdrop" onClick={() => setMenu(false)} />
          <aside className={`store__sheet ${isClient ? 'store__sheet--side' : 'store__sheet--drop'}`} aria-label="Menú">
            <div className="store__sheet-head">
              <span className="brand-mark"><ShoppingBag size={20} strokeWidth={2.2} /></span>
              <div className="store__brand-text">
                <strong>{brandFirst} {brandRest.join(' ')}</strong>
                <span>Tienda en línea</span>
              </div>
              <button type="button" className="btn-icon btn-icon--sm" onClick={() => setMenu(false)} aria-label="Cerrar menú"><X size={18} /></button>
            </div>

            <div className="store__sheet-scroll">
              <span className="store__sheet-label">Tienda</span>
              {SECTIONS.map(([id, label, Icon]) => (
                <button key={id} type="button" className={`store__sheet-item ${isOn(id) ? 'is-active' : ''}`} onClick={() => goSection(id)}>
                  <span className="store__sheet-icon"><Icon size={18} /></span>{label}
                </button>
              ))}
              {isClient && (
                <>
                  <span className="store__sheet-label">Mi cuenta</span>
                  <button type="button" className={`store__sheet-item ${isOn('pedidos') ? 'is-active' : ''}`} onClick={() => goSection('pedidos')}>
                    <span className="store__sheet-icon ic--amber"><ClipboardList size={18} /></span>Mis pedidos
                    {pendingOrders > 0 && <span className="store__sheet-count">{pendingOrders}</span>}
                  </button>
                  <button type="button" className={`store__sheet-item ${isOn('facturas') ? 'is-active' : ''}`} onClick={() => goSection('facturas')}>
                    <span className="store__sheet-icon ic--blue"><ReceiptText size={18} /></span>Mis facturas
                  </button>
                  <button type="button" className={`store__sheet-item ${isOn('perfil') ? 'is-active' : ''}`} onClick={() => goSection('perfil')}>
                    <span className="store__sheet-icon ic--violet"><UserRound size={18} /></span>Mi perfil
                    {!customer?.doc && <span className="store__sheet-count">!</span>}
                  </button>
                  <button type="button" className="store__sheet-item" onClick={() => { setMenu(false); setPanel('cart') }}>
                    <span className="store__sheet-icon ic--pink"><ShoppingCart size={18} /></span>Mi carrito
                    {units > 0 && <span className="store__sheet-count store__sheet-count--blue">{units}</span>}
                  </button>
                </>
              )}
            </div>

            <div className="store__sheet-foot">
              {isClient ? (
                <>
                  <div className="store__sheet-user">
                    <span className="user-chip__avatar"><Avatar name={user.name} size={40} /><i className="user-chip__online" /></span>
                    <div><strong>{user.name}</strong><span>Cliente · en línea</span></div>
                    <button type="button" className="store__sheet-logout-btn" onClick={logout}><LogOut size={16} /> Salir</button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn--secondary btn--block" onClick={() => navigate('/login')}><LogIn size={16} /> Iniciar sesión</button>
                  <button type="button" className="btn btn--primary btn--block" onClick={() => navigate('/registro')}><UserPlus size={16} /> Crear cuenta</button>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      <main className="store__main" id="inicio">
        {view === 'pedidos' ? (
          <OrdersPage orders={orders} settings={settings} productMap={productMap} onInvoice={setInvoice} onShop={() => goSection('catalogo')} onInvoices={() => goSection('facturas')} />
        ) : view === 'perfil' ? (
          <ProfilePage user={user} customer={customer} orders={orders} onSave={async (data) => {
            return updateMyProfile(data)
          }} />
        ) : view === 'facturas' ? (
          <InvoicesPage orders={orders} settings={settings} onOpen={setInvoice} onShop={() => goSection('catalogo')} onOrders={() => goSection('pedidos')} />
        ) : (
          <>
        <section className="hero">
          <div className="hero__copy">
            <span className="hero__eyebrow"><Sparkles size={14} /> {isClient ? `Hola, ${firstName} · bienvenida a ${settings.storeName}` : `${settings.storeName} · Tienda en línea`}</span>
            <h1>Moda que te hace sentir única.</h1>
            <p>
              {isClient
                ? 'Elige tu talla y color, agrégalo al carrito y haz tu pedido en segundos. Te avisamos cuando esté confirmado.'
                : 'Descubre nuestro catálogo con precios y disponibilidad en tiempo real. Crea tu cuenta gratis para comprar en línea.'}
            </p>
            <div className="hero__actions">
              <button className="btn btn--primary btn--lg" onClick={() => scrollTo('catalogo')}><LayoutGrid size={18} /> Ver catálogo</button>
              {isClient ? (
                <button className="btn btn--glass btn--lg" onClick={() => goSection('pedidos')}><ClipboardList size={18} /> Mis pedidos</button>
              ) : (
                <button className="btn btn--glass btn--lg" onClick={() => navigate('/registro')}><UserPlus size={18} /> Crear cuenta</button>
              )}
              <a className="btn btn--glass btn--lg" href={waLink(settings.phone, `Hola ${settings.storeName}, quiero información.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> WhatsApp</a>
            </div>
            <div className="hero__pills">
              <span className="hero__pill hero__pill--ok"><i /> {inStock} productos disponibles</span>
              {settings.address && <span className="hero__pill"><Truck size={14} /> {settings.address}</span>}
            </div>
          </div>
          <div className="hero__visual">
            <div className="hero__photo"><img src="/img/brand/portada-rojo.jpg" alt="Modelo con conjunto rojo frente al cielo azul" /></div>
          </div>
        </section>

        {isClient && (
          <section className="stats store__stats">
            <Stat tone="blue" icon={ClipboardList} label="Mis pedidos" value={orders.length} hint="Desde que creaste tu cuenta" />
            <Stat tone="amber" icon={Clock} label="Por confirmar" value={pendingOrders} hint={pendingOrders ? 'La tienda te contactará pronto' : 'Todo al día'} />
            <Stat tone="green" icon={Wallet} label="Total comprado" value={money(spent)} hint="Según tus facturas pagadas" />
            <Stat tone="pink" icon={ShoppingCart} label="En tu carrito" value={units} hint={units ? money(cart.reduce((a, l) => a + l.qty * l.price, 0)) : 'Agrega tus favoritas'} />
          </section>
        )}

        {!isClient && (
          <section className="store__cta">
            <span className="card__title-icon"><UserPlus size={20} /></span>
            <div>
              <strong>Crea tu cuenta y compra en línea</strong>
              <span>Arma tu carrito, guarda tus datos de envío y sigue el estado de tus pedidos.</span>
            </div>
            <button className="btn btn--secondary" onClick={() => navigate('/login')}>Ya tengo cuenta</button>
            <button className="btn btn--primary" onClick={() => navigate('/registro')}>Crear cuenta gratis <ArrowRight size={16} /></button>
          </section>
        )}

        <section className="card store__catalog" id="catalogo">
          <div className="card__head">
            <div className="card__title-icon"><ShoppingBag size={20} /></div>
            <div><h3>Catálogo</h3><p>{loadingCatalog ? 'Cargando prendas…' : `${list.length} ${list.length === 1 ? 'producto' : 'productos'} · toca uno para ver colores y tallas`}</p></div>
          </div>
          <div className="store__filters store__filters--row">
            <div className="input-icon toolbar__search">
              <Search size={16} />
              <input className="input" placeholder="Buscar prendas…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="chips">
              <button className={`chip ${cat === 'all' ? 'is-active' : ''}`} onClick={() => setCat('all')}>Todo</button>
              {CATEGORIES.filter((c) => active.some((p) => p.category === c.id)).map((c) => (
                <button key={c.id} className={`chip ${cat === c.id ? 'is-active' : ''}`} onClick={() => setCat(c.id)}>{c.name}</button>
              ))}
            </div>
          </div>
          {loadingCatalog ? (
            <div className="store__grid" aria-busy="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="pcard pcard--skeleton">
                  <div className="pcard__img" />
                  <div className="pcard__body"><i /><i /></div>
                </div>
              ))}
            </div>
          ) : list.length ? (
            <div className="store__grid">
              {list.map((p) => {
                const st = stockOf(p)
                const colors = [...new Set(p.variants.map((v) => v.color))]
                const qtyInCart = p.variants.reduce((a, v) => a + (inCart[v.id] || 0), 0)
                return (
                  <button key={p.id} className={`pcard ${st <= 0 ? 'is-out' : ''}`} onClick={() => st > 0 && setOpen(p)}>
                    <div className="pcard__img">
                      <img src={p.image} alt="" loading="lazy" />
                      <span className={`pcard__stock ${st <= 0 ? 'is-out' : st <= p.minStock ? 'is-low' : ''}`}>
                        {st <= 0 ? 'Agotado' : st <= p.minStock ? 'Últimas unidades' : 'Disponible'}
                      </span>
                      {qtyInCart > 0 && <span className="sf-incart"><ShoppingCart size={12} /> {qtyInCart}</span>}
                    </div>
                    <div className="pcard__body">
                      <strong className="pcard__name">{p.type} {p.name}</strong>
                      <span className="sf-swatches">
                        {colors.slice(0, 5).map((c) => <span key={c} className="swatch swatch--sm" title={c} style={{ background: COLORS[c] || '#ccc' }} />)}
                        {colors.length > 5 && <small>+{colors.length - 5}</small>}
                      </span>
                      <span className="pcard__price">{money(p.price)}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          ) : (
            <Empty icon={Search} title="No encontramos prendas" text="Prueba con otra búsqueda o categoría." />
          )}
        </section>

        <section className="store__info" id="nosotros">
          <div className="card">
            <div className="card__head"><div className="card__title-icon ic--green"><Truck size={20} /></div><div><h3>Envíos</h3><p>{settings.address || 'Consulta la cobertura por WhatsApp'}</p></div></div>
            <p className="store__text">Confirmamos tu pedido por WhatsApp y te enviamos el número de guía apenas sale tu paquete. También puedes recoger en tienda.</p>
          </div>
          <div className="card">
            <div className="card__head"><div className="card__title-icon ic--amber"><RefreshCcw size={20} /></div><div><h3>Cambios y garantía</h3><p>Compra con tranquilidad</p></div></div>
            <p className="store__text">{settings.receiptFooter || 'Consulta nuestras políticas de cambio por WhatsApp.'}</p>
          </div>
          <div className="card">
            <div className="card__head"><div className="card__title-icon ic--violet"><CreditCard size={20} /></div><div><h3>Medios de pago</h3><p>Paga como prefieras</p></div></div>
            <div className="chips">
              {PAYMENT_METHODS.filter((m) => ONLINE_METHODS.includes(m.id)).map((m) => <span key={m.id} className={`sf-pay ic--${PAY_TONE[m.id]}`}>{m.id === 'efectivo' ? <Truck size={14} /> : <CreditCard size={14} />} {m.id === 'efectivo' ? 'Contra entrega' : m.name}</span>)}
            </div>
          </div>
        </section>

        <section className="hero hero--report store__contact" id="contacto">
          <div className="hero__copy">
            <span className="hero__eyebrow"><MessageCircle size={14} /> Contacto</span>
            <h1>¿Lista para tu próximo look?</h1>
            <p>Escríbenos y te asesoramos con tallas, colores y disponibilidad.</p>
            <div className="hero__actions">
              <a className="btn btn--primary btn--lg" href={waLink(settings.phone, `Hola ${settings.storeName}, necesito asesoría.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Escribir por WhatsApp</a>
              {settings.instagram && <a className="btn btn--glass btn--lg" href={igLink(settings.instagram)} target="_blank" rel="noopener noreferrer"><AtSign size={18} /> Instagram</a>}
            </div>
          </div>
          <div className="hero__visual hero__visual--report">
            <ul className="hero__rank">
              {settings.phone && <li><span className="hero__rank-n sf-dot ic--green"><Phone size={15} /></span><div><strong>WhatsApp</strong><span>{settings.phone}</span></div></li>}
              {settings.instagram && <li><span className="hero__rank-n sf-dot ic--pink"><AtSign size={15} /></span><div><strong>Instagram</strong><span>{settings.instagram}</span></div></li>}
              {settings.address && <li><span className="hero__rank-n sf-dot ic--red"><MapPin size={15} /></span><div><strong>Ubicación</strong><span>{settings.address}</span></div></li>}
              <li><span className="hero__rank-n sf-dot ic--blue"><Store size={15} /></span><div><strong>Tienda</strong><span>{settings.legalName || settings.storeName}</span></div></li>
            </ul>
          </div>
        </section>

          </>
        )}

        <footer className="store__footer">© {new Date().getFullYear()} {settings.storeName} · {settings.legalName || settings.storeName}</footer>
      </main>

      {open && <ProductModal product={open} settings={settings} canBuy={isClient} inCart={inCart} onAdd={addToCart} onClose={() => setOpen(null)} />}
      {panel === 'cart' && <CartDrawer cart={cart} setQty={setQty} remove={remove} onCheckout={() => setPanel('checkout')} onClose={() => setPanel(null)} />}
      {panel === 'checkout' && <CheckoutModal cart={cart} customer={customer} settings={settings} onPlace={place} onClose={() => setPanel('cart')} />}
      {invoice && <ReceiptModal sale={invoice} onClose={() => setInvoice(null)} />}
      {notif && <ClientNotifications orders={orders} settings={settings} seenAt={notif.seenAt} onClose={() => setNotif(null)} onGo={(id) => { setNotif(null); goSection(id) }} />}
      {panel?.done && (
        <Modal icon={CheckCircle2} tone="success" badge="Pendiente" title="¡Pedido recibido!" subtitle={`${invoiceNo(settings, panel.done.number)} · ${money(panel.done.total)}`} onClose={() => setPanel(null)} size="sm"
          footer={
            <>
              <button className="btn btn--secondary" onClick={() => { setPanel(null); goSection('pedidos') }}><ClipboardList size={16} /> Ver mis pedidos</button>
              <a className="btn btn--primary" href={waLink(settings.phone, `Hola ${settings.storeName}, hice el pedido ${invoiceNo(settings, panel.done.number)} por ${money(panel.done.total)}.`)} target="_blank" rel="noopener noreferrer"><MessageCircle size={16} /> Avisar por WhatsApp</a>
            </>
          }
        >
          <p className="confirm__msg">Apartamos tus prendas. La tienda revisará tu pedido y te contactará al celular que registraste para confirmar el pago y la entrega.</p>
        </Modal>
      )}
    </div>
  )
}
