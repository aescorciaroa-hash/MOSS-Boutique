import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowDownToLine, ArrowUpFromLine, Boxes, Download, ImagePlus, Package, Pencil, Plus, Search, SlidersHorizontal, Trash2, X } from 'lucide-react'
import { useApp, stockOf } from '../context/AppContext'
import { CATEGORIES, COLORS } from '../lib/seed'
import { compactMoney, downloadCSV, fmtDateTime, money, normalize, pct, uid } from '../lib/format'
import { Badge, Confirm, Empty, Field, Modal, MoneyInput, Pager, Segmented, Select, Thumb, usePaged } from '../components/ui'

function resizeImage(file, max = 640) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', 0.82))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function ProductForm({ initial, onClose, onSave, products }) {
  const isNew = !initial?.id
  const [f, setF] = useState(() => ({
    sku: '',
    name: '',
    type: '',
    category: 'bodys',
    price: '',
    cost: '',
    image: '',
    minStock: 2,
    active: true,
    ...initial,
  }))
  const [colors, setColors] = useState(() => (initial?.variants ? [...new Set(initial.variants.map((v) => v.color))] : ['Negro']))
  const [sizes, setSizes] = useState(() => (initial?.variants ? [...new Set(initial.variants.map((v) => v.size))] : ['Única']))
  const [stock, setStock] = useState(() => Object.fromEntries((initial?.variants || []).map((v) => [`${v.color}|${v.size}`, v.stock])))
  const [newColor, setNewColor] = useState('')
  const [newSize, setNewSize] = useState('')
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const suggestSku = (category) => {
    const prefix = CATEGORIES.find((c) => c.id === category).prefix
    const nums = products.filter((p) => p.sku.startsWith(prefix)).map((p) => parseInt(p.sku.split('-')[1]) || 0)
    return `${prefix}-${String(Math.max(0, ...nums) + 1).padStart(3, '0')}`
  }

  const price = Number(f.price) || 0
  const cost = Number(f.cost) || 0
  const margin = price ? (price - cost) / price : 0

  const addColor = (c) => {
    const v = c.trim()
    if (v && !colors.includes(v)) setColors((cs) => [...cs, v])
    setNewColor('')
  }
  const addSize = () => {
    newSize
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => setSizes((ss) => (ss.includes(s) ? ss : [...ss.filter((x) => x !== 'Única' || s === 'Única'), s])))
    setNewSize('')
  }

  const submit = () => {
    const err = {}
    if (!f.name.trim()) err.name = 'Requerido'
    if (!f.type.trim()) err.type = 'Requerido'
    const sku = (f.sku || suggestSku(f.category)).toUpperCase()
    if (products.some((p) => p.sku === sku && p.id !== initial?.id)) err.sku = 'Este código ya existe'
    if (price <= 0) err.price = 'Precio inválido'
    if (!colors.length) err.colors = 'Agrega al menos un color'
    if (!sizes.length) err.sizes = 'Agrega al menos una talla'
    setErrors(err)
    if (Object.keys(err).length) return
    const prevVariants = initial?.variants || []
    const variants = colors.flatMap((color) =>
      sizes.map((size) => {
        const prev = prevVariants.find((v) => v.color === color && v.size === size)
        return { id: prev?.id || uid(`${sku}-`), color, size, stock: Math.max(0, parseInt(stock[`${color}|${size}`]) || 0) }
      })
    )
    onSave({
      ...f,
      id: initial?.id || sku.toLowerCase(),
      sku,
      name: f.name.trim(),
      type: f.type.trim(),
      price,
      cost,
      minStock: Number(f.minStock) || 0,
      variants,
      createdAt: initial?.createdAt || new Date().toISOString(),
    })
  }

  return (
    <Modal
      icon={Package}
      badge={isNew ? 'Nuevo' : 'Edición'}
      title={isNew ? 'Nuevo producto' : 'Editar producto'}
      subtitle={isNew ? 'Define la información, el precio y el stock por variante' : `${initial.sku} · ${initial.type} ${initial.name}`}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <label className="switch switch--inline">
            <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
            <span className="switch__track" /> Activo para la venta
          </label>
          <button className="btn btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit}>Guardar producto</button>
        </>
      }
    >
      <div className="pform">
        <div className="pform__image">
          <div className="pform__preview">
            {f.image ? <img src={f.image} alt="" /> : <ImagePlus size={28} />}
          </div>
          <label className="btn btn--secondary btn--sm btn--block">
            <ImagePlus size={14} /> Subir foto
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const data = await resizeImage(file)
                setF((x) => ({ ...x, image: data }))
              }}
            />
          </label>
          {f.image && <button className="btn btn--ghost btn--sm btn--block" onClick={() => setF((x) => ({ ...x, image: '' }))}>Quitar foto</button>}
        </div>

        <div className="form-grid">
          <Field label="Nombre" error={errors.name}>
            <input className="input" value={f.name} onChange={set('name')} placeholder="Ej: Copa Blonda" autoFocus />
          </Field>
          <Field label="Tipo de prenda" error={errors.type}>
            <input className="input" value={f.type} onChange={set('type')} placeholder="Ej: Body, Vestido, Collar" />
          </Field>
          <Field label="Categoría">
            <Select className="input" value={f.category} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Código / SKU" error={errors.sku} hint={!f.sku ? `Se asignará ${suggestSku(f.category)}` : null}>
            <input className="input mono" value={f.sku} onChange={set('sku')} placeholder={suggestSku(f.category)} disabled={!isNew} />
          </Field>
          <Field label="Precio de venta" error={errors.price}>
            <MoneyInput value={f.price} onChange={set('price')} />
          </Field>
          <Field label="Costo" hint={price ? `Margen: ${pct(margin)} · Utilidad ${money(price - cost)}` : 'Costo de compra unitario'}>
            <MoneyInput value={f.cost} onChange={set('cost')} />
          </Field>
          <Field label="Stock mínimo por variante" hint="Genera alerta al llegar a este nivel">
            <input className="input" type="number" min="0" value={f.minStock} onChange={set('minStock')} />
          </Field>
        </div>
      </div>

      <div className="variants">
        <div className="variants__head">
          <h4>Variantes y existencias</h4>
          <span className="text-muted small">{colors.length * sizes.length} variantes · {colors.reduce((a, c) => a + sizes.reduce((b, s) => b + (parseInt(stock[`${c}|${s}`]) || 0), 0), 0)} unidades</span>
        </div>
        <div className="variants__defs">
          <Field label="Colores" error={errors.colors}>
            <div className="tags">
              {colors.map((c) => (
                <span key={c} className="tag">
                  <span className="swatch swatch--sm" style={{ background: COLORS[c] || '#999' }} />
                  {c}
                  <button onClick={() => setColors((cs) => cs.filter((x) => x !== c))} aria-label={`Quitar ${c}`}><X size={12} /></button>
                </span>
              ))}
              <Select className="input input--sm tags__add" value="" onChange={(e) => (e.target.value === '__custom' ? setNewColor(' ') : addColor(e.target.value))}>
                <option value="">+ Agregar color</option>
                {Object.keys(COLORS).filter((c) => !colors.includes(c)).map((c) => <option key={c}>{c}</option>)}
                <option value="__custom">Otro…</option>
              </Select>
              {newColor !== '' && (
                <input
                  className="input input--sm tags__add"
                  autoFocus
                  placeholder="Nombre del color"
                  value={newColor.trimStart()}
                  onChange={(e) => setNewColor(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addColor(newColor))}
                  onBlur={() => addColor(newColor)}
                />
              )}
            </div>
          </Field>
          <Field label="Tallas" error={errors.sizes}>
            <div className="tags">
              {sizes.map((s) => (
                <span key={s} className="tag">
                  {s}
                  <button onClick={() => setSizes((ss) => ss.filter((x) => x !== s))} aria-label={`Quitar ${s}`}><X size={12} /></button>
                </span>
              ))}
              <input
                className="input input--sm tags__add"
                placeholder="Ej: S, M, L o 8, 10"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSize())}
                onBlur={addSize}
              />
            </div>
          </Field>
        </div>
        {colors.length > 0 && sizes.length > 0 && (
          <div className="table-wrap">
            <table className="matrix">
              <thead>
                <tr>
                  <th>Color \ Talla</th>
                  {sizes.map((s) => <th key={s}>{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {colors.map((c) => (
                  <tr key={c}>
                    <th><span className="swatch swatch--sm" style={{ background: COLORS[c] || '#999' }} /> {c}</th>
                    {sizes.map((s) => (
                      <td key={s}>
                        <input
                          className="input input--sm"
                          type="number"
                          min="0"
                          value={stock[`${c}|${s}`] ?? ''}
                          placeholder="0"
                          onChange={(e) => setStock((st) => ({ ...st, [`${c}|${s}`]: e.target.value }))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  )
}

function AdjustModal({ product, onClose, onSave }) {
  const [variantId, setVariantId] = useState(product.variants[0].id)
  const [type, setType] = useState('entrada')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const v = product.variants.find((x) => x.id === variantId)
  const n = parseInt(qty) || 0
  const result = type === 'entrada' ? v.stock + n : type === 'salida' ? Math.max(0, v.stock - n) : n
  const REASONS = {
    entrada: ['Compra a proveedor', 'Devolución de cliente', 'Traslado', 'Otro'],
    salida: ['Prenda averiada', 'Uso interno / fotos', 'Pérdida', 'Traslado', 'Otro'],
    ajuste: ['Conteo físico', 'Corrección de error'],
  }

  return (
    <Modal
      icon={SlidersHorizontal}
      badge="Kardex"
      title="Ajustar existencias"
      subtitle={`${product.sku} · ${product.type} ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancelar</button>
          <button
            className="btn btn--primary"
            disabled={type !== 'ajuste' ? n <= 0 : qty === '' || result === v.stock}
            onClick={() => onSave(variantId, result - v.stock, type, reason || REASONS[type][0])}
          >
            Registrar movimiento
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Tipo de movimiento" full>
          <Segmented value={type} onChange={(t) => { setType(t); setReason('') }} options={[['entrada', 'Entrada'], ['salida', 'Salida'], ['ajuste', 'Ajuste por conteo']]} />
        </Field>
        <Field label="Variante" full>
          <Select className="input" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
            {product.variants.map((x) => (
              <option key={x.id} value={x.id}>
                {x.color}{x.size !== 'Única' ? ` · Talla ${x.size}` : ''} — {x.stock} und.
              </option>
            ))}
          </Select>
        </Field>
        <Field label={type === 'ajuste' ? 'Cantidad contada' : 'Cantidad'}>
          <input className="input" type="number" min="0" autoFocus value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        <Field label="Motivo">
          <Select className="input" value={reason || REASONS[type][0]} onChange={(e) => setReason(e.target.value)}>
            {REASONS[type].map((r) => <option key={r}>{r}</option>)}
          </Select>
        </Field>
      </div>
      <div className="adjust-preview">
        <div><span>Stock actual</span><strong>{v.stock}</strong></div>
        <span className="adjust-preview__arrow">→</span>
        <div><span>Nuevo stock</span><strong>{result}</strong></div>
      </div>
    </Modal>
  )
}

const MOVE_TONE = { venta: 'neutral', entrada: 'success', salida: 'warning', ajuste: 'info', 'anulación': 'accent' }

export default function Inventory() {
  const { products, movements, productMap, userMap, saveProduct, deleteProduct, adjustStock, toast, isAdmin } = useApp()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState('products')
  const [q, setQ] = useState(params.get('q') || '')
  const [cat, setCat] = useState('all')
  // Muestra solo el stock bajo y baja hasta la lista (que está debajo del banner).
  const showLow = () => {
    setTab('products'); setStockFilter('low'); setQ(''); setCat('all')
    setTimeout(() => document.getElementById('inv-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
  }
  // Si se llega desde otra pantalla con ?stock= o ?q=, aplica el filtro aunque ya estés en Inventario.
  const urlStock = params.get('stock'), urlQ = params.get('q')
  useEffect(() => { if (urlStock) setStockFilter(urlStock) }, [urlStock])
  useEffect(() => { if (urlQ != null) setQ(urlQ) }, [urlQ])
  const [stockFilter, setStockFilter] = useState(params.get('stock') || 'all')
  const [editing, setEditing] = useState(null)
  const [adjusting, setAdjusting] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const list = useMemo(() => {
    const n = normalize(q)
    return products.filter((p) => {
      if (cat !== 'all' && p.category !== cat) return false
      if (n && !normalize(`${p.sku} ${p.type} ${p.name}`).includes(n)) return false
      const st = stockOf(p)
      if (stockFilter === 'low' && !p.variants.some((v) => v.stock <= p.minStock)) return false
      if (stockFilter === 'out' && st > 0) return false
      if (stockFilter === 'inactive' && p.active) return false
      return true
    })
  }, [products, q, cat, stockFilter])
  const pg = usePaged(list)
  const pgMoves = usePaged(movements)

  const totals = useMemo(() => {
    const units = products.reduce((a, p) => a + stockOf(p), 0)
    const value = products.reduce((a, p) => a + stockOf(p) * p.price, 0)
    const cost = products.reduce((a, p) => a + stockOf(p) * p.cost, 0)
    const out = products.reduce((a, p) => a + p.variants.filter((v) => v.stock === 0).length, 0)
    const lowRefs = products.filter((p) => p.active && p.variants.some((v) => v.stock <= p.minStock)).length
    return { units, value, cost, out, lowRefs }
  }, [products])

  const exportCSV = () =>
    downloadCSV('inventario.csv', [
      ['SKU', 'Producto', 'Categoría', 'Color', 'Talla', 'Stock', 'Precio', 'Costo', 'Activo'],
      ...products.flatMap((p) =>
        p.variants.map((v) => [p.sku, `${p.type} ${p.name}`, CATEGORIES.find((c) => c.id === p.category)?.name, v.color, v.size, v.stock, p.price, p.cost, p.active ? 'Sí' : 'No'])
      ),
    ])

  return (
    <div className="page">
      <section className="hero hero--report">
        <div className="hero__copy">
          <span className="hero__eyebrow"><Package size={14} /> Inventario · {products.length} referencias</span>
          <span className="hero__kicker">Valor del inventario a precio de venta</span>
          <h1 className="hero__amount">{money(totals.value)}</h1>
          <div className="hero__pills">
            <span className="hero__pill"><Boxes size={14} /> {totals.units} unidades en stock</span>
            {totals.lowRefs > 0 ? (
              <span className="hero__pill hero__pill--warn"><i /> {totals.lowRefs} con stock bajo</span>
            ) : (
              <span className="hero__pill hero__pill--ok"><i /> Inventario saludable</span>
            )}
            {totals.out > 0 && <span className="hero__pill">{totals.out} variantes agotadas</span>}
          </div>
          <div className="hero__actions">
            {isAdmin && <button className="btn btn--primary btn--lg" onClick={() => setEditing({})}><Plus size={18} /> Nuevo producto</button>}
            <button className="btn btn--glass btn--lg" onClick={showLow}><SlidersHorizontal size={18} /> Ver stock bajo</button>
            <button className="btn btn--glass btn--lg" onClick={exportCSV}><Download size={18} /> Exportar</button>
          </div>
        </div>
        <div className="hero__visual hero__visual--report">
          <div className="hero__visual-head">
            <strong>Resumen del inventario</strong>
          </div>
          <div className="hero__tiles hero__tiles--grid">
            <div className="hero__tile"><Package size={16} /><strong>{products.filter((p) => p.active).length}</strong><span>Referencias activas</span></div>
            <div className="hero__tile"><Boxes size={16} /><strong>{totals.units}</strong><span>Unidades en stock</span></div>
            <div className="hero__tile"><ArrowDownToLine size={16} /><strong>{compactMoney(totals.cost)}</strong><span>Valor a costo</span></div>
            <div className="hero__tile"><ArrowUpFromLine size={16} /><strong>{pct(totals.value ? (totals.value - totals.cost) / totals.value : 0, 0)}</strong><span>Margen potencial</span></div>
          </div>
        </div>
      </section>

      <div className="tabs" id="inv-list">
        <button className={tab === 'products' ? 'is-active' : ''} onClick={() => setTab('products')}>Productos</button>
        <button className={tab === 'moves' ? 'is-active' : ''} onClick={() => setTab('moves')}>Movimientos <span className="tabs__count">{movements.length}</span></button>
      </div>

      {tab === 'products' ? (
        <div className="card card--flush">
          <div className="toolbar">
            <div className="input-icon toolbar__search">
              <Search size={16} />
              <input className="input" placeholder="Buscar por código o nombre…" value={q} onChange={(e) => { setQ(e.target.value); if (params.get('q')) setParams({}) }} />
            </div>
            <Select className="input input--sm toolbar__select" value={cat} onChange={(e) => setCat(e.target.value)}>
              <option value="all">Todas las categorías</option>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
            <Segmented size="sm" value={stockFilter} onChange={setStockFilter} options={[['all', 'Todos'], ['low', 'Stock bajo'], ['out', 'Agotados'], ['inactive', 'Inactivos']]} />
          </div>
          {list.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="hide-mobile">Categoría</th>
                    <th className="num">Precio</th>
                    <th className="num hide-mobile">Costo</th>
                    <th className="num hide-mobile">Margen</th>
                    <th className="num">Stock</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {pg.rows.map((p) => {
                    const st = stockOf(p)
                    const low = p.variants.some((v) => v.stock <= p.minStock)
                    const open = expanded === p.id
                    return (
                      <FragmentRow key={p.id}>
                        <tr className={`${p.active ? '' : 'is-muted'} row-click`} onClick={() => setExpanded(open ? null : p.id)}>
                          <td>
                            <div className="cell-product">
                              <Thumb src={p.image} size={44} />
                              <div>
                                <strong>{p.type} {p.name}</strong>
                                <span className="text-muted small mono">{p.sku} · {p.variants.length} variante{p.variants.length > 1 ? 's' : ''}</span>
                              </div>
                            </div>
                          </td>
                          <td className="hide-mobile">{CATEGORIES.find((c) => c.id === p.category)?.name}</td>
                          <td className="num strong">{money(p.price)}</td>
                          <td className="num hide-mobile">{money(p.cost)}</td>
                          <td className="num hide-mobile">{pct(p.price ? (p.price - p.cost) / p.price : 0, 0)}</td>
                          <td className="num">
                            <span className={`stock-pill ${st === 0 ? 'is-out' : low ? 'is-low' : ''}`}>{st}</span>
                          </td>
                          <td>{p.active ? <Badge tone="success" dot>Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                          <td className="actions" onClick={(e) => e.stopPropagation()}>
                            <button className="btn-icon btn-icon--sm" title="Ajustar stock" onClick={() => setAdjusting(p)}><SlidersHorizontal size={15} /></button>
                            {isAdmin && <button className="btn-icon btn-icon--sm" title="Editar" onClick={() => setEditing(p)}><Pencil size={15} /></button>}
                            {isAdmin && <button className="btn-icon btn-icon--sm" title="Eliminar" onClick={() => setDeleting(p)}><Trash2 size={15} /></button>}
                          </td>
                        </tr>
                        {open && (
                          <tr className="row-expand">
                            <td colSpan={8}>
                              <div className="variant-chips">
                                {p.variants.map((v) => (
                                  <div key={v.id} className={`variant-chip ${v.stock === 0 ? 'is-out' : v.stock <= p.minStock ? 'is-low' : ''}`}>
                                    <span className="swatch swatch--sm" style={{ background: COLORS[v.color] || '#999' }} />
                                    <span>{v.color}{v.size !== 'Única' ? ` · ${v.size}` : ''}</span>
                                    <strong>{v.stock}</strong>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </FragmentRow>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {list.length ? <Pager pg={pg} noun="productos" /> : (
            <Empty icon={Package} title="No hay productos con estos filtros" />
          )}
        </div>
      ) : (
        <div className="card card--flush">
          {movements.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Producto</th>
                    <th>Variante</th>
                    <th>Tipo</th>
                    <th className="num">Cantidad</th>
                    <th className="hide-mobile">Detalle</th>
                    <th className="hide-mobile">Usuario</th>
                  </tr>
                </thead>
                <tbody>
                  {pgMoves.rows.map((m) => {
                    const p = productMap[m.productId]
                    const v = p?.variants.find((x) => x.id === m.variantId)
                    return (
                      <tr key={m.id}>
                        <td className="nowrap">{fmtDateTime(m.date)}</td>
                        <td>{p ? `${p.type} ${p.name}` : 'Producto eliminado'}</td>
                        <td>{v ? `${v.color}${v.size !== 'Única' ? ` · ${v.size}` : ''}` : '—'}</td>
                        <td><Badge tone={MOVE_TONE[m.type]}>{m.type[0].toUpperCase() + m.type.slice(1)}</Badge></td>
                        <td className={`num strong ${m.qty > 0 ? 'text-success' : 'text-danger'}`}>{m.qty > 0 ? `+${m.qty}` : m.qty}</td>
                        <td className="hide-mobile text-muted">{m.reason}</td>
                        <td className="hide-mobile">{userMap[m.userId]?.name || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
          {movements.length ? <Pager pg={pgMoves} noun="movimientos" /> : (
            <Empty icon={Boxes} title="Sin movimientos registrados" text="Las ventas, anulaciones, entradas y salidas de mercancía aparecerán aquí." />
          )}
        </div>
      )}

      {editing && (
        <ProductForm
          initial={editing.id ? editing : null}
          products={products}
          onClose={() => setEditing(null)}
          onSave={(p) => {
            saveProduct(p)
            setEditing(null)
            toast(editing.id ? 'Producto actualizado' : 'Producto creado', 'success', `${p.type} ${p.name} · ${p.sku}`)
          }}
        />
      )}
      {adjusting && (
        <AdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSave={(variantId, delta, type, reason) => {
            adjustStock(adjusting.id, variantId, delta, type, reason)
            setAdjusting(null)
            toast('Movimiento registrado', 'success', `${adjusting.type} ${adjusting.name} · ${delta > 0 ? '+' : ''}${delta} und. · Kardex al día`)
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="Eliminar producto"
          danger
          confirmLabel="Eliminar"
          message={`¿Eliminar ${deleting.type} ${deleting.name} (${deleting.sku})? El historial de ventas se conserva. Si solo quieres dejar de venderlo, márcalo como inactivo.`}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            deleteProduct(deleting.id)
            setDeleting(null)
            toast('Producto eliminado', 'success', `${deleting.type} ${deleting.name} · ${deleting.sku}`)
          }}
        />
      )}
    </div>
  )
}

function FragmentRow({ children }) {
  return <>{children}</>
}
