import { Navigate, Route, Routes } from 'react-router-dom'
import { RefreshCcw, WifiOff } from 'lucide-react'
import { useApp } from './context/AppContext'
import Layout from './components/Layout'
import { Toasts } from './components/ui'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Sales from './pages/Sales'
import Inventory from './pages/Inventory'
import Customers from './pages/Customers'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import Storefront from './pages/Storefront'

function AdminOnly({ children }) {
  const { isAdmin } = useApp()
  return isAdmin ? children : <Navigate to="/" replace />
}

function Offline({ message, onRetry }) {
  return (
    <div className="splash">
      <div className="splash__card">
        <span className="splash__icon ic--red"><WifiOff size={26} /></span>
        <strong>No pudimos conectar con la tienda</strong>
        <span>{message}</span>
        <button className="btn btn--primary" onClick={onRetry}><RefreshCcw size={16} /> Reintentar</button>
      </div>
    </div>
  )
}

export default function App() {
  const { user, status, loadError, refresh } = useApp()

  // Solo se bloquea la pantalla si no hay conexión y nunca se cargó nada.
  // Mientras carga, la tienda se muestra de una vez (con el catálogo en esqueleto).
  if (status === 'offline') {
    return <Offline message={loadError} onRetry={refresh} />
  }

  return (
    <>
      {status === 'loading' ? (
        // Mientras llega la primera respuesta se muestra la tienda sin cambiar la dirección,
        // así quien abre /#/ventas con sesión iniciada llega a Ventas y no a Inicio.
        <Routes>
          <Route path="*" element={<Storefront key="cargando" />} />
        </Routes>
      ) : status === 'setup' ? (
        // Primer ingreso: no hay administrador todavía, se crea antes de cualquier otra cosa.
        <Routes>
          <Route path="*" element={<Login mode="setup" />} />
        </Routes>
      ) : !user ? (
        // Visitantes: primero la tienda; desde allí entran o se registran.
        <Routes>
          <Route index element={<Storefront key={user?.id || 'visitante'} />} />
          <Route path="login" element={<Login />} />
          <Route path="registro" element={<Login mode="register" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : user.role === 'cliente' ? (
        <Routes>
          <Route path="*" element={<Storefront key={user?.id || 'visitante'} />} />
        </Routes>
      ) : (
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="ventas" element={<Sales />} />
            <Route path="inventario" element={<Inventory />} />
            <Route path="clientes" element={<Customers />} />
            <Route path="reportes" element={<AdminOnly><Reports /></AdminOnly>} />
            <Route path="configuracion" element={<AdminOnly><Settings /></AdminOnly>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      <Toasts />
    </>
  )
}
