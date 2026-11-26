import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { buildCatalog, DEFAULT_SETTINGS } from '../lib/seed'
import { uid } from '../lib/format'

// Los datos viven en el servidor (API PHP + MySQL). En el navegador solo se guardan
// preferencias visuales (tema y color) y el carrito de cada cliente.
const API_URL = import.meta.env.VITE_API_URL || 'api/index.php'
const THEME_KEY = 'moss.pos.theme'
const ACCENT_KEY = 'moss.pos.accent.v4' // v4: Negro ónix pasa a ser el color principal
// Copia local de lo público (catálogo, ajustes y sesión) para pintar la tienda al instante
// mientras el servidor responde. Ventas, clientes y usuarios nunca se guardan en el navegador.
const CACHE_KEY = 'moss.cache.v1'
const EMPTY = { products: [], customers: [], sales: [], movements: [], users: [], settings: DEFAULT_SETTINGS }

const AppContext = createContext(null)

function loadPref(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export const stockOf = (p) => p.variants.reduce((a, v) => a + v.stock, 0)
export const variantLabel = (v) => [v.color, v.size !== 'Única' ? `Talla ${v.size}` : null].filter(Boolean).join(' · ')

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function call(action, payload = {}) {
  let res
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-Moss': '1' },
      body: JSON.stringify({ action, ...payload }),
    })
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisa tu internet.', 0)
  }
  let data
  try {
    data = await res.json()
  } catch {
    throw new ApiError('El servidor respondió con un error. Intenta de nuevo.', res.status)
  }
  if (!data.ok) throw new ApiError(data.error || 'No se pudo completar la acción.', res.status)
  return data
}

function loadCache() {
  const c = loadPref(CACHE_KEY, null)
  if (!c || !Array.isArray(c.products)) return null
  return c
}

function saveCache(st) {
  try {
    const u = st.user ? { id: st.user.id, name: st.user.name, username: st.user.username, role: st.user.role } : null
    localStorage.setItem(CACHE_KEY, JSON.stringify({ needsSetup: !!st.needsSetup, user: u, settings: st.settings || {}, products: st.products || [] }))
  } catch { /* sin espacio o modo privado: se ignora */ }
}

export function AppProvider({ children }) {
  const [cache] = useState(loadCache)
  const [db, setDb] = useState(() => (cache ? { ...EMPTY, products: cache.products, settings: { ...DEFAULT_SETTINGS, ...cache.settings } } : EMPTY))
  const [user, setUser] = useState(() => cache?.user || null)
  // loading | ready | setup | offline — con copia local se arranca directamente en 'ready'
  const [status, setStatus] = useState(() => (cache ? (cache.needsSetup ? 'setup' : 'ready') : 'loading'))
  const [loadError, setLoadError] = useState('')
  const [theme, setTheme] = useState(() => loadPref(THEME_KEY, 'light'))
  const [accent, setAccent] = useState(() => {
    const a = loadPref(ACCENT_KEY, 'onyx')
    return ['nude', 'onyx', 'navy', 'slate', 'emerald', 'wine', 'indigo'].includes(a) ? a : 'onyx'
  })
  const [toasts, setToasts] = useState([])
  const dbRef = useRef(db)
  dbRef.current = db
  const busy = useRef(0)
  const loaded = useRef(!!cache)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    // La barra del navegador en el celular toma el mismo color de fondo de la página (sin franja azul).
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
    if (bg) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg)
    try { localStorage.setItem(THEME_KEY, JSON.stringify(theme)) } catch { /* noop */ }
  }, [theme])
  useEffect(() => {
    document.documentElement.dataset.accent = accent
    try { localStorage.setItem(ACCENT_KEY, JSON.stringify(accent)) } catch { /* noop */ }
  }, [accent])

  const toast = useCallback((message, type = 'success', detail) => {
    const id = uid()
    setToasts((t) => [...t.slice(-3), { id, message, type, detail }])
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3800)
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4100)
  }, [])

  // Aplica el estado que devuelve el servidor
  const apply = useCallback((st) => {
    if (!st) return
    const next = {
      products: st.products || [],
      customers: st.customers || [],
      sales: st.sales || [],
      movements: st.movements || [],
      users: st.users || [],
      settings: { ...DEFAULT_SETTINGS, ...(st.settings || {}) },
    }
    dbRef.current = next
    loaded.current = true
    setDb(next)
    setUser(st.user || null)
    setStatus(st.needsSetup ? 'setup' : 'ready')
    saveCache(st)
  }, [])

  const refresh = useCallback(async () => {
    try {
      const r = await call('state')
      apply(r.state)
      setLoadError('')
    } catch (e) {
      if (!loaded.current) {
        setStatus('offline')
        setLoadError(e.message)
      }
    }
  }, [apply])

  useEffect(() => { refresh() }, [refresh])

  // Mantiene los datos al día: nuevos pedidos, cambios de stock y de estado.
  useEffect(() => {
    if (!user) return
    const every = user.role === 'admin' ? 15000 : 30000
    const t = setInterval(() => {
      if (busy.current === 0 && document.visibilityState === 'visible') refresh()
    }, every)
    const onFocus = () => { if (busy.current === 0) refresh() }
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [user, refresh])

  // Ejecuta una acción en el servidor. Con `optimistic` la pantalla se actualiza al instante.
  const run = useCallback(async (action, payload, { optimistic, silent } = {}) => {
    busy.current += 1
    const before = dbRef.current
    if (optimistic) {
      const next = optimistic(before)
      dbRef.current = next
      setDb(next)
    }
    try {
      const r = await call(action, payload)
      if (r.state) apply(r.state)
      return r
    } catch (e) {
      if (optimistic) { dbRef.current = before; setDb(before) }
      if (e.status === 401) await refresh()
      if (!silent) toast('No se pudo guardar', 'error', e.message)
      throw e
    } finally {
      busy.current -= 1
    }
  }, [apply, refresh, toast])

  const isAdmin = user?.role === 'admin'

  // ---------------- Sesión ----------------
  const login = useCallback(async (username, password) => {
    try {
      const r = await call('login', { username, password })
      apply(r.state)
      return { user: r.state.user }
    } catch (e) {
      return { error: e.message }
    }
  }, [apply])
  const logout = useCallback(async () => {
    try { apply((await call('logout')).state) } catch { setUser(null) }
  }, [apply])
  const setupAdmin = useCallback(async ({ name, username, password }) => {
    try {
      const r = await call('setup', { name, username, password, catalog: buildCatalog(), settings: DEFAULT_SETTINGS })
      apply(r.state)
      return { ok: true }
    } catch (e) {
      return { error: e.message }
    }
  }, [apply])
  const register = useCallback(async (data) => {
    try {
      const r = await call('register', data)
      apply(r.state)
      return { user: r.state.user }
    } catch (e) {
      return { error: e.message }
    }
  }, [apply])
  const updateMyProfile = useCallback(async (data) => {
    try {
      const r = await call('updateProfile', data)
      apply(r.state)
      return { ok: true }
    } catch (e) {
      return { error: e.message }
    }
  }, [apply])

  // ---------------- Pedidos ----------------
  // Compra desde la tienda: el servidor valida precios y stock, aparta las unidades y crea el pedido.
  const placeOrder = useCallback(async ({ items, method, delivery, address, city, phone, note }) => {
    try {
      const r = await run('placeOrder', {
        items: items.map(({ productId, variantId, qty }) => ({ productId, variantId, qty })),
        method, delivery, address, city, phone, note,
      }, { silent: true })
      return { sale: r.sale }
    } catch (e) {
      return { error: e.message }
    }
  }, [run])

  const confirmOrder = useCallback((id) => run('confirmOrder', { id }, {
    optimistic: (d) => ({ ...d, sales: d.sales.map((s) => (s.id === id && s.status === 'pendiente' ? { ...s, status: 'completada', confirmedAt: new Date().toISOString(), sellerId: user?.id } : s)) }),
  }).catch(() => {}), [run, user])

  const voidSale = useCallback((id, reason) => run('voidSale', { id, reason }, {
    optimistic: (d) => ({ ...d, sales: d.sales.map((s) => (s.id === id ? { ...s, status: 'anulada', voidReason: reason, voidedAt: new Date().toISOString() } : s)) }),
  }).catch(() => {}), [run])

  // ---------------- Inventario ----------------
  const saveProduct = useCallback((product) => {
    const prev = dbRef.current.products.find((p) => p.id === product.id)
    // Stock con el que se abrió el formulario: así no se pisan los pedidos que entren mientras se edita.
    const baseStock = prev ? Object.fromEntries(prev.variants.map((v) => [v.id, v.stock])) : null
    return run('sync', { upsert: { products: [baseStock ? { ...product, _baseStock: baseStock } : product] } }, {
      optimistic: (d) => ({ ...d, products: prev ? d.products.map((p) => (p.id === product.id ? product : p)) : [product, ...d.products] }),
    }).catch(() => {})
  }, [run])
  const deleteProduct = useCallback((id) => run('sync', { delete: { products: [id] } }, {
    optimistic: (d) => ({ ...d, products: d.products.filter((p) => p.id !== id) }),
  }).catch(() => {}), [run])
  const adjustStock = useCallback((productId, variantId, qty, type, reason) => run('adjustStock', { productId, variantId, qty, type, reason }, {
    optimistic: (d) => ({
      ...d,
      products: d.products.map((p) => (p.id !== productId ? p : { ...p, variants: p.variants.map((v) => (v.id === variantId ? { ...v, stock: Math.max(0, v.stock + qty) } : v)) })),
    }),
  }).catch(() => {}), [run])

  // ---------------- Clientes ----------------
  const saveCustomer = useCallback((c) => {
    const customer = c.id ? c : { ...c, id: uid('c'), createdAt: new Date().toISOString() }
    run('sync', { upsert: { customers: [customer] } }, {
      optimistic: (d) => ({
        ...d,
        customers: d.customers.some((x) => x.id === customer.id) ? d.customers.map((x) => (x.id === customer.id ? customer : x)) : [customer, ...d.customers],
      }),
    }).catch(() => {})
    return customer
  }, [run])
  const deleteCustomer = useCallback((id) => run('sync', { delete: { customers: [id] } }, {
    optimistic: (d) => ({ ...d, customers: d.customers.filter((c) => c.id !== id) }),
  }).catch(() => {}), [run])

  // ---------------- Configuración / usuarios ----------------
  const saveSettings = useCallback((s) => {
    const { nextSaleNumber, ...rest } = s // el consecutivo lo lleva el servidor
    return run('sync', { settings: rest }, { optimistic: (d) => ({ ...d, settings: { ...d.settings, ...rest } }) }).catch(() => {})
  }, [run])
  const saveUser = useCallback(async (u) => {
    try {
      await run('saveUser', u, { silent: true })
      return { ok: true }
    } catch (e) {
      return { error: e.message }
    }
  }, [run])
  const deleteUser = useCallback((id) => run('deleteUser', { id }).catch(() => {}), [run])
  const clearTransactions = useCallback(() => run('clearData').catch(() => {}), [run])
  const importData = useCallback(async (data) => {
    if (!data || !Array.isArray(data.products) || !Array.isArray(data.sales)) throw new Error('Archivo no válido')
    await run('importData', { data }, { silent: true })
  }, [run])
  const exportData = useCallback(async () => (await call('exportData')).data, [])

  // ---------------- Derivados ----------------
  const productMap = useMemo(() => Object.fromEntries(db.products.map((p) => [p.id, p])), [db.products])
  const customerMap = useMemo(() => Object.fromEntries(db.customers.map((c) => [c.id, c])), [db.customers])
  const userMap = useMemo(() => Object.fromEntries(db.users.map((u) => [u.id, u])), [db.users])
  const lowStock = useMemo(() => db.products.filter((p) => p.active && p.variants.some((v) => v.stock <= p.minStock)), [db.products])

  const value = {
    ...db,
    status,
    loadError,
    refresh,
    productMap,
    customerMap,
    userMap,
    lowStock,
    user,
    isAdmin,
    login,
    logout,
    setupAdmin,
    theme,
    setTheme,
    accent,
    setAccent,
    toasts,
    toast,
    voidSale,
    confirmOrder,
    register,
    updateMyProfile,
    placeOrder,
    saveProduct,
    deleteProduct,
    adjustStock,
    saveCustomer,
    deleteCustomer,
    saveSettings,
    saveUser,
    deleteUser,
    clearTransactions,
    importData,
    exportData,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => useContext(AppContext)
