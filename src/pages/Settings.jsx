import { useRef, useState } from 'react'
import { Database, Download, Hash, KeyRound, Palette, Pencil, Plus, Printer, Receipt, Settings as SettingsIcon, Store, Trash2, Upload, UserCog } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { downloadBlob } from '../lib/format'
import { ACCENTS } from '../lib/seed'
import { Avatar, Badge, Confirm, Field, Modal, MoneyInput, Segmented, Select } from '../components/ui'
import { FitReceipt, ReceiptContent } from '../components/Receipt'

function UserForm({ initial, onClose, onSave, users }) {
  const [f, setF] = useState({ name: '', username: '', password: '', role: 'cliente', active: true, ...initial })
  const [err, setErr] = useState({})
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const submit = () => {
    const e = {}
    if (!f.name.trim()) e.name = 'Requerido'
    if (!/^[a-z0-9._-]{3,}$/i.test(f.username)) e.username = 'Mínimo 3 caracteres, sin espacios'
    if (users.some((u) => u.username.toLowerCase() === f.username.toLowerCase() && u.id !== f.id)) e.username = 'Ya existe'
    if ((!f.id || f.password) && f.password.length < 8) e.password = 'Mínimo 8 caracteres'
    setErr(e)
    if (!Object.keys(e).length) onSave(f)
  }
  return (
    <Modal
      icon={UserCog}
      badge={f.role === 'admin' ? 'Administrador' : 'Cliente'}
      title={f.id ? 'Editar usuario' : 'Nuevo usuario'}
      subtitle="Acceso al sistema con usuario y contraseña"
      onClose={onClose}
      size="sm"
      footer={<><button className="btn btn--secondary" onClick={onClose}>Cancelar</button><button className="btn btn--primary" onClick={submit}>Guardar</button></>}
    >
      <div className="form-grid form-grid--1">
        <Field label="Nombre" error={err.name}><input className="input" autoFocus value={f.name} onChange={set('name')} /></Field>
        <Field label="Usuario" error={err.username}><input className="input" value={f.username} onChange={set('username')} autoComplete="off" /></Field>
        <Field label={f.id ? 'Nueva contraseña' : 'Contraseña'} error={err.password} hint={f.id ? 'Déjala vacía para conservar la actual' : 'Mínimo 8 caracteres'}><input className="input" type="password" value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        <Field label="Rol" hint={f.role === 'admin' ? 'Acceso total: reportes, configuración, edición de productos y anulaciones.' : 'Ve la tienda en línea: catálogo, precios, disponibilidad y pedidos por WhatsApp. No accede al sistema de ventas.'}>
          <Select className="input" value={f.role} onChange={set('role')}>
            <option value="cliente">Cliente</option>
            <option value="admin">Administrador</option>
          </Select>
        </Field>
        <label className="switch switch--inline">
          <input type="checkbox" checked={f.active} onChange={(e) => setF((x) => ({ ...x, active: e.target.checked }))} />
          <span className="switch__track" /> Usuario activo
        </label>
      </div>
    </Modal>
  )
}

export default function Settings() {
  const app = useApp()
  const { settings, saveSettings, users, saveUser, deleteUser, user, toast, clearTransactions, importData, exportData, sales, accent, setAccent, theme, setTheme } = app
  const download = async () => {
    try {
      const data = await exportData()
      downloadBlob(`moss-respaldo-${new Date().toISOString().slice(0, 10)}.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    } catch (e) {
      toast('No se pudo descargar', 'error', e.message)
    }
  }
  const [f, setF] = useState(settings)
  const [editingUser, setEditingUser] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const fileRef = useRef(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))
  const dirty = JSON.stringify(f) !== JSON.stringify({ ...settings, nextSaleNumber: f.nextSaleNumber })

  const previewSale = sales[0] || {
    number: settings.nextSaleNumber,
    date: new Date().toISOString(),
    items: [{ name: 'Body Copa Blonda', sku: 'BOD-006', color: 'Café', size: 'Única', qty: 1, price: 70000 }],
    subtotal: 70000, discount: 0, tax: 0, total: 70000, payments: [{ method: 'efectivo', amount: 70000 }], received: 70000, change: 0, sellerId: user.id, status: 'completada',
  }

  return (
    <div className="page">
      <section className="hero hero--report">
        <div className="hero__copy">
          <span className="hero__eyebrow"><SettingsIcon size={14} /> Configuración · Panel del administrador</span>
          <span className="hero__kicker">Datos del negocio</span>
          <h1 className="hero__amount hero__amount--name">{settings.storeName}</h1>
          <p>Datos del negocio, comprobantes, metas, usuarios y respaldo de información.</p>
          <div className="hero__pills">
            <span className={`hero__pill ${dirty ? 'hero__pill--warn' : 'hero__pill--ok'}`}><i /> {dirty ? 'Cambios sin guardar' : 'Todo guardado'}</span>
            <span className="hero__pill"><Printer size={14} /> Papel {settings.paperWidth || '80'} mm</span>
          </div>
          <div className="hero__actions">
            <button className="btn btn--primary btn--lg" disabled={!dirty} onClick={() => { saveSettings({ ...f, nextSaleNumber: settings.nextSaleNumber }); toast('Configuración guardada', 'success', 'Los cambios ya están activos') }}>
              Guardar cambios
            </button>
            <button className="btn btn--glass btn--lg" onClick={download}><Download size={18} /> Descargar respaldo</button>
          </div>
        </div>
        <div className="hero__visual hero__visual--report">
          <div className="hero__visual-head">
            <strong>Estado del sistema</strong>
          </div>
          <div className="hero__tiles hero__tiles--grid">
            <div className="hero__tile"><UserCog size={16} /><strong>{users.filter((u) => u.active).length}</strong><span>Usuarios activos</span></div>
            <div className="hero__tile"><Receipt size={16} /><strong>{settings.invoicePrefix || 'FV'}</strong><span>Prefijo de factura</span></div>
            <div className="hero__tile"><Hash size={16} /><strong>{settings.nextSaleNumber}</strong><span>Próxima factura</span></div>
            <div className="hero__tile"><Database size={16} /><strong>{sales.length}</strong><span>Ventas guardadas</span></div>
          </div>
        </div>
      </section>

      <div className="settings">
        {/* Formulario y vista previa juntos: la vista previa acompaña al formulario y se detiene al terminar */}
        <div className="settings__top">
        <section className="card">
          <div className="card__head">
            <div className="card__title-icon"><Store size={18} /></div>
            <div><h3>Datos del negocio</h3><p>Aparecen en los comprobantes de venta</p></div>
          </div>
          <div className="form-grid">
            <Field label="Nombre comercial"><input className="input" value={f.storeName} onChange={set('storeName')} /></Field>
            <Field label="Razón social"><input className="input" value={f.legalName} onChange={set('legalName')} /></Field>
            <Field label="NIT" hint="Opcional"><input className="input" value={f.nit} onChange={set('nit')} /></Field>
            <Field label="Teléfono / WhatsApp"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
            <Field label="Dirección"><input className="input" value={f.address} onChange={set('address')} /></Field>
            <Field label="Instagram"><input className="input" value={f.instagram} onChange={set('instagram')} /></Field>
            <Field label="Impuesto sobre ventas (%)" hint="Déjalo en 0 si no eres responsable de IVA">
              <input className="input" type="number" min="0" max="30" value={f.taxRate} onChange={(e) => setF((x) => ({ ...x, taxRate: Number(e.target.value) || 0 }))} />
            </Field>
            <Field label="Régimen tributario">
              <Select className="input" value={f.taxRegime} onChange={set('taxRegime')}>
                <option>No responsable de IVA</option>
                <option>Responsable de IVA</option>
                <option>Régimen simple de tributación</option>
              </Select>
            </Field>
          </div>

          <div className="form-section">
            <h4>Metas de ventas</h4>
            <p>Se muestran como indicadores de progreso en el inicio</p>
          </div>
          <div className="form-grid">
            <Field label="Meta diaria" hint="Facturado de hoy">
              <MoneyInput value={f.goalDay ?? ''} onChange={(e) => setF((x) => ({ ...x, goalDay: Number(e.target.value) || 0 }))} />
            </Field>
            <Field label="Meta de 7 días" hint="Últimos 7 días">
              <MoneyInput value={f.goalWeek ?? ''} onChange={(e) => setF((x) => ({ ...x, goalWeek: Number(e.target.value) || 0 }))} />
            </Field>
            <Field label="Meta mensual" hint="Mes en curso">
              <MoneyInput value={f.goalMonth ?? ''} onChange={(e) => setF((x) => ({ ...x, goalMonth: Number(e.target.value) || 0 }))} />
            </Field>
          </div>

          <div className="form-section">
            <h4>Factura de venta</h4>
            <p>Formato del tiquete que se imprime en la impresora térmica</p>
          </div>
          <div className="form-grid">
            <Field label="Prefijo de facturación" hint={`Ejemplo: ${(f.invoicePrefix || 'FV')}-000001`}>
              <input className="input mono" value={f.invoicePrefix} onChange={(e) => setF((x) => ({ ...x, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) }))} />
            </Field>
            <Field label="Ancho del papel">
              <div className="paper-opts">
                {[['80', '80 mm', 'Estándar'], ['58', '58 mm', 'Portátil']].map(([v, l, d]) => (
                  <button key={v} type="button" className={`paper-opt ${f.paperWidth === v ? 'is-active' : ''}`} onClick={() => setF((x) => ({ ...x, paperWidth: v }))}>
                    <strong>{l}</strong>
                    <span>{d}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Resolución de facturación" hint="Opcional. Ej: Res. DIAN 18764000000000 del 2026-01-01, FV-1 a FV-5000" full>
              <input className="input" value={f.resolution} onChange={set('resolution')} />
            </Field>
            <Field label="Mensaje al pie de la factura" full>
              <textarea className="input" rows={3} value={f.receiptFooter} onChange={set('receiptFooter')} />
            </Field>
            <Field label="Título del documento" hint="Aparece arriba del número de factura">
              <input className="input" value={f.invoiceTitle ?? 'FACTURA DE VENTA'} onChange={set('invoiceTitle')} placeholder="FACTURA DE VENTA" />
            </Field>
            <Field label="Documento por defecto" hint="Para clientes sin cédula o NIT">
              <input className="input mono" value={f.defaultDoc ?? '222222222222'} onChange={set('defaultDoc')} inputMode="numeric" />
            </Field>
            <Field label="Mensaje de agradecimiento" hint="Déjalo vacío para no mostrarlo">
              <input className="input" value={f.invoiceThanks ?? '¡GRACIAS POR SU COMPRA!'} onChange={set('invoiceThanks')} />
            </Field>
            <Field label="Firma al final" hint="Última línea de la factura">
              <input className="input" value={f.invoiceSignature ?? 'MOSS · Tienda en línea'} onChange={set('invoiceSignature')} />
            </Field>
            <div className="receipt-toggles" role="group" aria-label="Datos que se muestran en la factura">
              {[
                ['showBarcode', 'Código de barras'],
                ['showSeller', 'Quién atendió'],
                ['showCustomerDoc', 'Cédula / NIT del cliente'],
                ['showChannel', 'Canal de venta'],
                ['showPrintedAt', 'Fecha de impresión'],
              ].map(([k, label]) => (
                <label key={k} className="switch">
                  <input type="checkbox" checked={f[k] !== false} onChange={(e) => setF((x) => ({ ...x, [k]: e.target.checked }))} />
                  <span className="switch__track" /> {label}
                </label>
              ))}
            </div>
          </div>
          <div className="card__actions">
            <button className="btn btn--secondary" disabled={!dirty} onClick={() => setF(settings)}>Descartar</button>
            <button className="btn btn--primary" disabled={!dirty} onClick={() => { saveSettings({ ...f, nextSaleNumber: settings.nextSaleNumber }); toast('Configuración guardada', 'success', 'Los cambios ya están activos') }}>Guardar cambios</button>
          </div>
        </section>

        <aside className="card settings__preview">
          <div className="card__head"><div className="card__title-icon"><Printer size={18} /></div><div><h3>Vista previa de la factura</h3><p>Impresora térmica de {f.paperWidth || '80'} mm · se actualiza mientras editas</p></div></div>
          <div className="receipt-frame"><FitReceipt reserve={330}><div className="receipt-paper"><ReceiptContent sale={previewSale} settings={f} /></div></FitReceipt></div>
        </aside>
        </div>

        <section className="card settings__wide">
          <div className="card__head">
            <div className="card__title-icon"><Palette size={18} /></div>
            <div><h3>Apariencia</h3><p>Color de marca y tema del sistema (se guarda en este equipo)</p></div>
          </div>
          <div className="appearance">
            <div className="accent-opts">
              {ACCENTS.map((a) => (
                <button key={a.id} className={`accent-opt ${accent === a.id ? 'is-active' : ''}`} onClick={() => setAccent(a.id)}>
                  <span className="accent-opt__swatch" style={{ background: a.color }} />
                  {a.name}
                </button>
              ))}
            </div>
            <Segmented value={theme} onChange={setTheme} options={[['light', 'Claro'], ['dark', 'Oscuro']]} />
          </div>
        </section>

        <section className="card card--flush settings__wide">
          <div className="card__head">
            <div className="card__title-icon"><UserCog size={18} /></div>
            <div><h3>Usuarios y permisos</h3><p>Personas con acceso al sistema</p></div>
            <button className="btn btn--secondary btn--sm" onClick={() => setEditingUser({})}><Plus size={14} /> Nuevo usuario</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td><div className="cell-user"><Avatar name={u.name} size={32} /><div><strong>{u.name}{u.id === user.id && <span className="text-muted"> (tú)</span>}</strong><span className="text-muted small">@{u.username}</span></div></div></td>
                    <td>{u.role === 'admin' ? <Badge tone="accent"><KeyRound size={12} /> Administrador</Badge> : <Badge tone="info">Cliente</Badge>}</td>
                    <td>{u.active ? <Badge tone="success" dot>Activo</Badge> : <Badge>Inactivo</Badge>}</td>
                    <td className="actions">
                      <button className="btn-icon btn-icon--sm" onClick={() => setEditingUser(u)} title="Editar"><Pencil size={15} /></button>
                      {u.id !== user.id && (
                        <button className="btn-icon btn-icon--sm" title="Eliminar" onClick={() => setConfirm({ kind: 'user', user: u })}><Trash2 size={15} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card settings__wide">
          <div className="card__head">
            <div className="card__title-icon"><Database size={18} /></div>
            <div><h3>Datos y respaldo</h3><p>La información se guarda en la base de datos del servidor. Descarga copias de seguridad con frecuencia.</p></div>
          </div>
          <div className="data-actions">
            <div className="data-action">
              <div><strong>Descargar copia de seguridad</strong><p>Exporta productos, ventas, clientes y configuración en un archivo .json.</p></div>
              <button
                className="btn btn--secondary"
                onClick={download}
              >
                <Download size={16} /> Descargar
              </button>
            </div>
            <div className="data-action">
              <div><strong>Restaurar copia de seguridad</strong><p>Reemplaza toda la información actual por la de un archivo de respaldo.</p></div>
              <button className="btn btn--secondary" onClick={() => fileRef.current.click()}><Upload size={16} /> Restaurar</button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file) return
                  try {
                    await importData(JSON.parse(await file.text()))
                    toast('Respaldo restaurado', 'success', `${file.name} · datos cargados`)
                  } catch {
                    toast('Respaldo no válido', 'error', 'El archivo no tiene el formato de respaldo de MOSS')
                  }
                }}
              />
            </div>
            <div className="data-action">
              <div><strong>Borrar ventas y movimientos</strong><p>Elimina ventas, movimientos y clientes sin cuenta. Conserva el catálogo, los usuarios y las clientas registradas.</p></div>
              <button className="btn btn--danger-ghost" onClick={() => setConfirm({ kind: 'clear' })}><Trash2 size={16} /> Borrar</button>
            </div>
          </div>
        </section>
      </div>

      {editingUser && (
        <UserForm
          initial={editingUser}
          users={users}
          onClose={() => setEditingUser(null)}
          onSave={(u) => {
            if (u.id === user.id && (u.role !== 'admin' || !u.active)) {
              toast('Acción no permitida', 'warning', 'No puedes quitarte el rol de administrador ni desactivarte')
              return
            }
            saveUser(u).then((r) => {
              if (r.error) return toast('No se pudo guardar', 'error', r.error)
              setEditingUser(null)
              toast('Usuario guardado', 'success', `${u.name} · @${u.username}`)
            })
          }}
        />
      )}
      {confirm?.kind === 'user' && (
        <Confirm title="Eliminar usuario" danger confirmLabel="Eliminar" message={`¿Eliminar el usuario ${confirm.user.name}? Sus ventas registradas se conservan.`} onClose={() => setConfirm(null)} onConfirm={() => { deleteUser(confirm.user.id); setConfirm(null); toast('Usuario eliminado', 'success', 'Sus ventas registradas se conservan') }} />
      )}
      {confirm?.kind === 'clear' && (
        <Confirm title="Borrar ventas y movimientos" danger confirmLabel="Borrar" message="Se eliminarán las ventas, los movimientos y los clientes sin cuenta. El catálogo, su stock y los usuarios se conservan. Te recomendamos descargar un respaldo antes." onClose={() => setConfirm(null)} onConfirm={() => { clearTransactions(); setConfirm(null); toast('Datos eliminados', 'success', 'Catálogo y usuarios conservados') }} />
      )}
    </div>
  )
}
