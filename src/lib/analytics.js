import { addDays, dayKey, startOfDay } from './format'
import { CATEGORIES, PAYMENT_METHODS } from './seed'

export const completed = (sales) => sales.filter((s) => s.status === 'completada')

export const inRange = (sales, [from, to]) =>
  sales.filter((s) => {
    const d = new Date(s.date)
    return d >= from && d < to
  })

export function summarize(sales) {
  const ok = completed(sales)
  const revenue = ok.reduce((a, s) => a + s.total, 0)
  const cost = ok.reduce((a, s) => a + s.items.reduce((b, i) => b + i.qty * (i.cost || 0), 0), 0)
  const units = ok.reduce((a, s) => a + s.items.reduce((b, i) => b + i.qty, 0), 0)
  const discounts = ok.reduce((a, s) => a + s.discount, 0)
  const profit = revenue - cost - ok.reduce((a, s) => a + (s.tax || 0), 0)
  return {
    count: ok.length,
    revenue,
    cost,
    profit,
    margin: revenue ? profit / revenue : 0,
    units,
    discounts,
    avgTicket: ok.length ? revenue / ok.length : 0,
    voided: sales.length - ok.length,
  }
}

export const growth = (cur, prev) => (prev ? (cur - prev) / prev : cur ? Infinity : 0)

const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

export function byDay(sales, [from, to]) {
  const ok = completed(sales)
  const map = {}
  ok.forEach((s) => {
    const k = dayKey(s.date)
    map[k] = map[k] || { value: 0, count: 0 }
    map[k].value += s.total
    map[k].count += 1
  })
  const out = []
  const end = to > new Date() ? addDays(startOfDay(), 1) : to
  const days = Math.round((end - from) / 864e5)
  for (let d = startOfDay(from); d < end; d = addDays(d, 1)) {
    const k = dayKey(d)
    out.push({
      label: days > 10 ? `${d.getDate()}/${d.getMonth() + 1}` : `${DOW[d.getDay()]} ${d.getDate()}`,
      full: d.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }),
      value: map[k]?.value || 0,
      sub: `${map[k]?.count || 0} ventas`,
    })
  }
  return out
}

export function byCategory(sales, productMap) {
  const map = {}
  completed(sales).forEach((s) =>
    s.items.forEach((i) => {
      const cat = productMap[i.productId]?.category || 'otros'
      map[cat] = (map[cat] || 0) + i.qty * i.price
    })
  )
  return CATEGORIES.map((c) => ({ label: c.name, value: map[c.id] || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function byMethod(sales) {
  const map = {}
  completed(sales).forEach((s) => s.payments.forEach((p) => (map[p.method] = (map[p.method] || 0) + p.amount)))
  return PAYMENT_METHODS.map((m) => ({ label: m.name, value: map[m.id] || 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value)
}

export function bySeller(sales, userMap) {
  const map = {}
  completed(sales).forEach((s) => {
    map[s.sellerId] = map[s.sellerId] || { count: 0, value: 0, units: 0 }
    map[s.sellerId].count++
    map[s.sellerId].value += s.total
    map[s.sellerId].units += s.items.reduce((a, i) => a + i.qty, 0)
  })
  return Object.entries(map)
    .map(([id, v]) => ({ id, name: userMap[id]?.name || 'Usuario eliminado', ...v }))
    .sort((a, b) => b.value - a.value)
}

export function byChannel(sales) {
  const map = {}
  completed(sales).forEach((s) => (map[s.channel || 'Tienda'] = (map[s.channel || 'Tienda'] || 0) + s.total))
  return Object.entries(map)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

export function topProducts(sales, productMap, limit = 10) {
  const map = {}
  completed(sales).forEach((s) =>
    s.items.forEach((i) => {
      map[i.productId] = map[i.productId] || { productId: i.productId, name: i.name, units: 0, revenue: 0, profit: 0 }
      map[i.productId].units += i.qty
      map[i.productId].revenue += i.qty * i.price
      map[i.productId].profit += i.qty * (i.price - (i.cost || 0))
    })
  )
  return Object.values(map)
    .map((r) => ({ ...r, product: productMap[r.productId] }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}
