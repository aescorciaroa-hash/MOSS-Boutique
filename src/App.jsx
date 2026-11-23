import { Navigate, Route, Routes } from 'react-router-dom'
import { RefreshCcw, ShoppingBag, WifiOff } from 'lucide-react'
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

function Splash({ offline, message, onRetry }) {
  return (
    <div className="splash">
      <div className="splash__card">
        <span className={`splash__icon ${offline ? 'ic--red' : ''}`}>{offline ? <WifiOff size={26} /> : <ShoppingBag size={26} strokeWidth={2.2} />}</span>
        <strong>{offline ? 'No pudimos conectar con la tienda' : 'MOSS Boutique'}</strong>
        <span>{offline ? message : 'Cargando…'}</span>
        {offline ? <button className="btn btn--primary" onClick={onRetry}><RefreshCcw size={16} /> Reintentar</button> : <i className="splash__bar" />}
      </div>
    </div>
  )
}

export default function App() {
  const { user, status, loadError, refresh } = useApp()

  if (status === 'loading' || status === 'offline') {
    return <Splash offline={status === 'offline'} message={loadError} onRetry={refresh} />
  }

  return (
    <>
      {status === 'setup' ? (
        // Primer ingreso: no hay administrador todavía, se crea antes de cualquier otra cosa.
        <Routes>
          <Route path="*" element={<Login mode="setup" />} />
        </Routes>
      ) : !user ? (
        // Visitantes: primero la tienda; desde allí entran o se registran.
        <Routes>
          <Route index element={<Storefront />} />
          <Route path="login" element={<Login />} />
          <Route path="registro" element={<Login mode="register" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : user.role === 'cliente' ? (
        <Routes>
          <Route path="*" element={<Storefront />} />
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
