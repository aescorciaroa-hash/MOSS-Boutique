import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Eye, EyeOff, IdCard, Lock, Mail, MapPin, MessageCircle, Phone, ShieldCheck, ShoppingBag, ShoppingCart, Truck, User, UserPlus,
} from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function Login({ mode = 'login' }) {
  const { login, register, setupAdmin, settings, toast } = useApp()
  const navigate = useNavigate()
  const isSetup = mode === 'setup'
  const isRegister = mode === 'register'
  const [sending, setSending] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [form, setForm] = useState({ name: '', doc: '', phone: '', email: '', city: '', password2: '' })
  const [show, setShow] = useState(false)
  const [error, setError] = useState('')
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setError('') }

  const submit = async (e) => {
    e.preventDefault()
    if (sending) return
    if (isSetup) {
      if (form.name.trim().length < 3) return setError('Escribe tu nombre completo.')
      if (!/^[a-zA-Z0-9._-]{3,}$/.test(username.trim())) return setError('El usuario debe tener al menos 3 caracteres, sin espacios.')
      if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
      if (password !== form.password2) return setError('Las contraseñas no coinciden.')
      setSending(true)
      const r = await setupAdmin({ name: form.name, username: username.trim().toLowerCase(), password })
      setSending(false)
      if (r.error) return setError(r.error)
      toast('¡Sistema listo!', 'success', 'Tu cuenta de administrador fue creada')
      navigate('/', { replace: true })
      return
    }
    if (!isRegister) {
      if (!username.trim() || !password) return setError('Escribe tu usuario y contraseña.')
      setSending(true)
      const r = await login(username.trim().toLowerCase(), password)
      setSending(false)
      if (r.error) setError(r.error)
      else navigate('/', { replace: true })
      return
    }
    if (form.name.trim().length < 3) return setError('Escribe tu nombre completo.')
    if (!/^\d{6,10}$/.test(form.doc.replace(/\D/g, ''))) return setError('Escribe tu número de cédula (6 a 10 dígitos).')
    if (form.phone.replace(/\D/g, '').length < 7) return setError('Escribe un celular válido para confirmar tus pedidos.')
    if (!/^[a-zA-Z0-9._-]{3,}$/.test(username.trim())) return setError('El usuario debe tener al menos 3 caracteres, sin espacios.')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== form.password2) return setError('Las contraseñas no coinciden.')
    setSending(true)
    const r = await register({ name: form.name, doc: form.doc, phone: form.phone, email: form.email, city: form.city, username: username.trim().toLowerCase(), password })
    setSending(false)
    if (r.error) return setError(r.error)
    toast('¡Cuenta creada!', 'success', `Bienvenida, ${form.name.split(' ')[0]}. Ya puedes comprar en la tienda.`)
    navigate('/', { replace: true })
  }

  const [brandFirst, ...brandRest] = (settings.storeName || 'MOSS').split(' ')
  const pwd = (value, onChange, placeholder, autoComplete) => (
    <div className="input-icon">
      <Lock size={17} />
      <input className="input" type={show ? 'text' : 'password'} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={placeholder} />
      <button type="button" className="input-icon__end" onClick={() => setShow((s) => !s)} aria-label="Mostrar contraseña">
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  )

  return (
    <div className="login">
      <section className="login__visual">
        <div className="login__visual-copy">
          <span className="login__visual-icon" aria-hidden="true">{isRegister ? <UserPlus size={24} /> : <ShoppingBag size={24} />}</span>
          <span className="hero__eyebrow"><ShoppingBag size={14} /> {settings.storeName} · Tienda en línea</span>
          <h2>{isSetup ? 'Configura tu tienda en un minuto.' : isRegister ? 'Crea tu cuenta y compra en minutos.' : 'Tu boutique favorita, a un clic.'}</h2>
          <p>{isSetup ? 'Crea la cuenta de administrador. Con ella manejas el inventario, los pedidos, los clientes y los reportes.' : isRegister ? 'Guarda tus datos de envío, arma tu carrito y sigue el estado de tus pedidos.' : `Entra para comprar en ${settings.storeName} y revisar tus pedidos.`}</p>
          <div className="hero__pills">
            <span className="hero__pill hero__pill--ok"><i /> Pedidos en línea</span>
            <span className="hero__pill"><ShieldCheck size={14} /> Datos protegidos</span>
          </div>
        </div>
        <div className="login__showcase">
          <div className="hero__photo"><img src="/img/brand/login-perchero.jpg" alt="Perchero con ropa de colores" /></div>
          <div className="hero__tiles">
            <div className="hero__tile"><ShoppingCart size={16} /><strong>Carrito</strong><span>Compra fácil</span></div>
            <div className="hero__tile"><Truck size={16} /><strong>Envíos</strong><span>A domicilio</span></div>
            <div className="hero__tile"><MessageCircle size={16} /><strong>Asesoría</strong><span>Por WhatsApp</span></div>
            <div className="hero__tile"><ShieldCheck size={16} /><strong>Seguro</strong><span>Pago confirmado</span></div>
          </div>
        </div>
      </section>

      <section className="login__panel">
        <form className="login__form" onSubmit={submit} noValidate>
          <div className="login__top">
            <div className="login__brand">
              <div className="brand-mark"><ShoppingBag size={20} strokeWidth={2.2} /></div>
              <div>
                <strong>{brandFirst}{brandRest.length > 0 && <em> {brandRest.join(' ')}</em>}</strong>
                <span>Tienda en línea</span>
              </div>
            </div>
            {!isSetup && <Link to="/" className="btn btn--secondary btn--sm"><ArrowLeft size={15} /> Tienda</Link>}
          </div>

          <div className="login__head">
            <span className="topbar__eyebrow">{isSetup ? 'Primer ingreso' : isRegister ? 'Nueva clienta' : 'Bienvenida de nuevo'}</span>
            <h1>{isSetup ? 'Crear administrador' : isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
            <p>{isSetup ? 'Esta cuenta tendrá acceso total al sistema' : isRegister ? 'Solo te toma un minuto' : 'Ingresa con tu usuario para continuar'}</p>
          </div>

          {isSetup && (
            <label className="field">
              <span className="field__label">Nombre completo</span>
              <div className="input-icon"><User size={17} /><input className="input" value={form.name} onChange={set('name')} autoFocus autoComplete="name" placeholder="Tu nombre" /></div>
            </label>
          )}
          {isRegister && (
            <>
              <label className="field">
                <span className="field__label">Nombre completo</span>
                <div className="input-icon"><User size={17} /><input className="input" value={form.name} onChange={set('name')} autoFocus autoComplete="name" placeholder="Ej: Laura Gómez" /></div>
              </label>
              <label className="field">
                <span className="field__label">Número de cédula</span>
                <div className="input-icon"><IdCard size={17} /><input className="input" value={form.doc} onChange={(e) => { setForm((f) => ({ ...f, doc: e.target.value.replace(/\D/g, '').slice(0, 10) })); setError('') }} inputMode="numeric" autoComplete="off" placeholder="Para tus facturas" /></div>
                <span className="field__hint">Solo tú puedes verla y cambiarla desde tu perfil.</span>
              </label>
              <div className="login__row">
                <label className="field">
                  <span className="field__label">Celular / WhatsApp</span>
                  <div className="input-icon"><Phone size={17} /><input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="300 000 0000" /></div>
                </label>
                <label className="field">
                  <span className="field__label">Ciudad</span>
                  <div className="input-icon"><MapPin size={17} /><input className="input" value={form.city} onChange={set('city')} autoComplete="address-level2" placeholder="Opcional" /></div>
                </label>
              </div>
              <label className="field">
                <span className="field__label">Correo</span>
                <div className="input-icon"><Mail size={17} /><input className="input" type="email" value={form.email} onChange={set('email')} autoComplete="email" placeholder="Opcional" /></div>
              </label>
            </>
          )}

          <label className="field">
            <span className="field__label">Usuario</span>
            <div className="input-icon">
              <User size={17} />
              <input className="input" value={username} onChange={(e) => { setUsername(e.target.value); setError('') }} autoFocus={!isRegister && !isSetup} autoComplete={isRegister || isSetup ? "off" : "username"} autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="usuario" />
            </div>
          </label>
          {isRegister || isSetup ? (
            <div className="login__row">
              <label className="field"><span className="field__label">Contraseña</span>{pwd(password, (e) => { setPassword(e.target.value); setError('') }, 'Mín. 8 caracteres', 'new-password')}</label>
              <label className="field"><span className="field__label">Repetir contraseña</span>{pwd(form.password2, set('password2'), '••••••••', 'new-password')}</label>
            </div>
          ) : (
            <label className="field"><span className="field__label">Contraseña</span>{pwd(password, (e) => { setPassword(e.target.value); setError('') }, '••••••••', 'current-password')}</label>
          )}
          {error && <div className="alert alert--danger">{error}</div>}
          <button className="btn btn--primary btn--lg btn--block" disabled={sending}>
            {sending ? 'Un momento…' : isSetup ? <><ShieldCheck size={18} /> Crear administrador</> : isRegister ? <><UserPlus size={18} /> Crear cuenta</> : <>Entrar <ArrowRight size={18} /></>}
          </button>
          {!isSetup && (
            <p className="login__switch">
              {isRegister ? <>¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link></> : <>¿Eres nueva? <Link to="/registro">Crea tu cuenta</Link></>}
            </p>
          )}

        </form>
        <p className="login__legal">© {new Date().getFullYear()} {settings.storeName}</p>
      </section>
    </div>
  )
}
