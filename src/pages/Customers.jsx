import { useMemo, useState } from 'react'
import { Download, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, Users, MessageCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { downloadCSV, fmtDate, money, normalize } from '../lib/format'
import { Avatar, Badge, Confirm, Drawer, Empty, Field, Modal, Pager, Select, usePaged } from '../components/ui'
import { SaleDetail } from './Sales'
import { invoiceNo } from '../components/Receipt'

export function CustomerForm({ initial = {}, onClose, onSave, docLocked = false }) {
  const [f, setF] = useState({ name: '', doc: '', phone: '', email: '', city: '', notes: '', ...initial })
  const [errors, setErrors] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const submit = (e) => {
    e.preventDefault()
    const err = {}
    if (f.name.trim().length < 3) err.name = 'Ingresa el nombre completo'
    if (f.phone && !/^\d{7,10}$/.test(f.phone.replace(/\s/g, ''))) err.phone = 'Teléfono no válido'
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) err.email = 'Correo no válido'
    setErrors(err)
    if (Object.keys(err).length) return
    onSave({ ...f, name: f.name.trim(), phone: f.phone.replace(/\s/g, '') })
  }

  return (
    <Modal
      icon={Users}
      badge={initial.id ? 'Edición' : 'Nuevo'}
      title={initial.id ? 'Editar cliente' : 'Nuevo cliente'}
      subtitle="Datos de contacto para tus ventas y comprobantes"
      onClose={onClose}
      footer={
        <>
          <button className="btn btn--secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn--primary" onClick={submit}>Guardar cliente</button>
        </>
      }
    >
      <form className="form-grid" onSubmit={submit}>
        <Field label="Nombre completo" error={errors.name} full>
          <input className="input" autoFocus value={f.name} onChange={set('name')} />
        </Field>
        <Field label="Documento (CC / NIT)" hint={docLocked ? 'Solo el cliente puede cambiarla desde su perfil' : null}>
          <input className="input" value={docLocked ? (f.doc ? `•••••${String(f.doc).slice(-3)}` : 'Sin registrar') : f.doc} onChange={set('doc')} inputMode="numeric" disabled={docLocked} />
        </Field>
        <Field label="Celular" error={errors.phone}>
          <input className="input" value={f.phone} onChange={set('phone')} inputMode="tel" />
        </Field>
        <Field label="Correo" error={errors.email}>
          <input className="input" value={f.email} onChange={set('email')} type="email" />
        </Field>
        <Field label="Ciudad">
          <input className="input" value={f.city} onChange={set('city')} />
        </Field>
        <Field label="Notas" hint="Preferencias, medidas, tallas habituales…" full>
          <textarea className="input" rows={3} value={f.notes} onChange={set('notes')} />
        </Field>
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

export default function Customers() {
  const { customers, sales, saveCustomer, deleteCustomer, toast, isAdmin, settings, users, customerMap } = useApp()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('spent')
  const [editing, setEditing] = useState(null)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [sale, setSale] = useState(null)

  const stats = useMemo(() => {
    const map = {}
    sales.forEach((s) => {
      if (!s.customerId || s.status !== 'completada') return
      const m = (map[s.customerId] = map[s.customerId] || { count: 0, spent: 0, last: null })
      m.count++
      m.spent += s.total
      if (!m.last || s.date > m.last) m.last = s.date
    })
    return map
  }, [sales])

  const list = useMemo(() => {
    const n = normalize(q)
    const r = customers.filter((c) => !n || normalize(`${c.name} ${c.doc} ${c.phone} ${c.email} ${c.city}`).includes(n))
    const st = (c) => stats[c.id] || { count: 0, spent: 0, last: '' }
    return [...r].sort((a, b) =>
      sort === 'name' ? a.name.localeCompare(b.name) : sort === 'recent' ? (st(b).last || '').localeCompare(st(a).last || '') : st(b).spent - st(a).spent
    )
  }, [customers, q, sort, stats])
  const pg = usePaged(list)

  const totalSpent = Object.values(stats).reduce((a, s) => a + s.spent, 0)
  const recurring = Object.values(stats).filter((s) => s.count > 1).length
  const topCustomers = customers.filter((c) => stats[c.id]?.spent > 0).sort((a, b) => stats[b.id].spent - stats[a.id].spent).slice(0, 4)
  const v = viewing ? customers.find((c) => c.id === viewing) : null
  const vSales = v ? sales.filter((s) => s.customerId === v.id) : []

  return (
    <div className="page">
      <section className="hero hero--report">
        <div className="hero__copy">
          <span className="hero__eyebrow"><Users size={14} /> Clientes · {customers.length} registrados</span>
          <span className="hero__kicker">Compras de clientes registrados</span>
          <h1 className="hero__amount">{money(totalSpent)}</h1>
          <div className="hero__pills">
            <span className="hero__pill hero__pill--ok"><i /> {recurring} recurrentes</span>
            <span className="hero__pill"><Users size={14} /> Promedio {money(Object.keys(stats).length ? totalSpent / Object.keys(stats).length : 0)}</span>
          </div>
          <div className="hero__actions">
            <button className="btn btn--primary btn--lg" onClick={() => setEditing({})}><Plus size={18} /> Nuevo cliente</button>
            <button
              className="btn btn--glass btn--lg"
              onClick={() =>
                downloadCSV('clientes.csv', [
                  ['Nombre', 'Documento', 'Celular', 'Correo', 'Ciudad', 'Compras', 'Total comprado', 'Última compra'],
                  ...list.map((c) => [c.name, c.doc, c.phone, c.email, c.city, stats[c.id]?.count || 0, stats[c.id]?.spent || 0, stats[c.id]?.last ? fmtDate(stats[c.id].last) : '']),
                ])
              }
            >
              <Download size={18} /> Exportar
            </button>
          </div>
        </div>
        <div className="hero__visual hero__visual--report">
          <div className="hero__visual-head">
            <strong>Mejores clientes</strong>
            <span className="hero__visual-sub">Por total comprado</span>
          </div>
          {topCustomers.length ? (
            <ul className="hero__rank">
              {topCustomers.map((c, i) => (
                <li key={c.id} onClick={() => setViewing(c.id)}>
                  <span className={`hero__rank-n ${i === 0 ? 'is-top' : ''}`}>{i + 1}</span>
                  <Avatar name={c.name} size={38} />
                  <div>
                    <strong>{c.name}</strong>
                    <span>{stats[c.id].count} {stats[c.id].count === 1 ? 'compra' : 'compras'}</span>
                  </div>
                  <b>{money(stats[c.id].spent)}</b>
                </li>
              ))}
            </ul>
          ) : (
            <p className="hero__visual-empty">Aún no hay compras de clientes registrados.</p>
          )}
        </div>
      </section>

      <div className="card card--flush">
        <div className="toolbar">
          <div className="input-icon toolbar__search">
            <Search size={16} />
            <input className="input" placeholder="Buscar por nombre, documento, celular o ciudad…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select className="input input--sm toolbar__select" value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="spent">Mayor compra</option>
            <option value="recent">Compra más reciente</option>
            <option value="name">Nombre A–Z</option>
          </Select>
        </div>
        {list.length ? (
          <div className="table-wrap">
            <table className="table table--hover">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th className="hide-mobile">Documento</th>
                  <th>Celular</th>
                  <th className="hide-mobile">Ciudad</th>
                  <th className="num">Compras</th>
                  <th className="num">Total comprado</th>
                  <th className="hide-mobile">Última compra</th>
                </tr>
              </thead>
              <tbody>
                {pg.rows.map((c) => {
                  const s = stats[c.id]
                  return (
                    <tr key={c.id} onClick={() => setViewing(c.id)}>
                      <td>
                        <div className="cell-user">
                          <Avatar name={c.name} size={32} />
                          <div>
                            <strong>{c.name}</strong>
                            <span className="text-muted small">{c.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="hide-mobile mono">{users.some((u) => u.customerId === c.id && u.role === 'cliente') ? (c.doc ? `•••••${String(c.doc).slice(-3)}` : '—') : c.doc || '—'}</td>
                      <td>{c.phone || '—'}</td>
                      <td className="hide-mobile">{c.city || '—'}</td>
                      <td className="num">{s?.count || 0}{s?.count > 1 && <Badge tone="accent">Recurrente</Badge>}</td>
                      <td className="num strong">{money(s?.spent || 0)}</td>
                      <td className="hide-mobile">{s?.last ? fmtDate(s.last) : <span className="text-muted">Sin compras</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        {list.length ? <Pager pg={pg} noun="clientes" /> : (
          <Empty icon={Users} title="No hay clientes" text="Registra clientes desde aquí o directamente en el punto de venta." />
        )}
      </div>

      {v && (
        <Drawer
          icon={Users}
          badge="Cliente"
          title={v.name}
          subtitle={`Cliente desde ${fmtDate(v.createdAt)}`}
          onClose={() => setViewing(null)}
          footer={
            <>
              {isAdmin && <button className="btn btn--danger-ghost" onClick={() => setDeleting(v)}><Trash2 size={16} /> Eliminar</button>}
              {v.phone && (
                <a className="btn btn--secondary" href={`https://wa.me/57${v.phone}`} target="_blank" rel="noreferrer"><MessageCircle size={16} /> WhatsApp</a>
              )}
              <button className="btn btn--primary" onClick={() => setEditing(v)}><Pencil size={16} /> Editar</button>
            </>
          }
        >
          <div className="profile">
            <Avatar name={v.name} size={56} />
            <div className="profile__contact">
              {v.phone && <span><Phone size={14} /> {v.phone}</span>}
              {v.email && <span><Mail size={14} /> {v.email}</span>}
              {v.city && <span><MapPin size={14} /> {v.city}</span>}
              {v.doc && <span className="text-muted">CC {v.doc}</span>}
            </div>
          </div>
          <div className="mini-stats">
            <div><span>Compras</span><strong>{stats[v.id]?.count || 0}</strong></div>
            <div><span>Total</span><strong>{money(stats[v.id]?.spent || 0)}</strong></div>
            <div><span>Ticket prom.</span><strong>{money(stats[v.id] ? stats[v.id].spent / stats[v.id].count : 0)}</strong></div>
          </div>
          {v.notes && <div className="note-box">{v.notes}</div>}
          <h4 className="section-title">Historial de compras</h4>
          {vSales.length ? (
            <ul className="list list--bordered">
              {vSales.map((s) => (
                <li key={s.id} className="list__item" onClick={() => setSale(s.id)}>
                  <div className="list__main">
                    <strong>{invoiceNo(settings, s.number)}</strong>
                    <span className="text-muted">{fmtDate(s.date)} · {s.items.map((i) => i.name).join(', ')}</span>
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
            <p className="text-muted">Este cliente aún no tiene compras registradas.</p>
          )}
        </Drawer>
      )}

      {editing && (
        <CustomerForm
          initial={editing}
          docLocked={!!editing.id && users.some((u) => u.customerId === editing.id && u.role === 'cliente')}
          onClose={() => setEditing(null)}
          onSave={(c) => {
            // La cédula de un cliente con cuenta solo la cambia el propio cliente.
            const locked = !!c.id && users.some((u) => u.customerId === c.id && u.role === 'cliente')
            saveCustomer(locked ? { ...c, doc: customerMap[c.id]?.doc || '' } : c)
            setEditing(null)
            toast(c.id ? 'Cliente actualizado' : 'Cliente creado', 'success', `${c.name} · ficha guardada`)
          }}
        />
      )}
      {deleting && (
        <Confirm
          title="Eliminar cliente"
          danger
          confirmLabel="Eliminar"
          message={`¿Eliminar a ${deleting.name}? Sus ventas se conservarán como "Consumidor final".`}
          onClose={() => setDeleting(null)}
          onConfirm={() => {
            deleteCustomer(deleting.id)
            setDeleting(null)
            setViewing(null)
            toast('Cliente eliminado', 'success', `${deleting.name} · ventas conservadas`)
          }}
        />
      )}
      {sale && sales.find((x) => x.id === sale) && <SaleDetail sale={sales.find((x) => x.id === sale)} onClose={() => setSale(null)} />}
    </div>
  )
}
