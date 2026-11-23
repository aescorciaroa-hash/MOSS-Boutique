// En celular las tablas se muestran como tarjetas: cada celda necesita el nombre de su
// columna (data-label) para mostrarlo encima del valor. Esto lo hace para todas las
// tablas .table del sistema, incluso las que aparecen después (modales, filtros, etc.).
function label(table) {
  const heads = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
  if (!heads.length) return
  table.querySelectorAll('tbody tr').forEach((tr) => {
    let col = 0
    for (const td of tr.children) {
      const name = heads[col] || ''
      if (td.getAttribute('data-label') !== name) td.setAttribute('data-label', name)
      col += td.colSpan || 1
    }
  })
}

export function installTableLabels() {
  let queued = false
  const run = () => {
    queued = false
    document.querySelectorAll('table.table').forEach(label)
  }
  const observer = new MutationObserver(() => {
    if (queued) return
    queued = true
    requestAnimationFrame(run)
  })
  observer.observe(document.body, { childList: true, subtree: true })
  run()
}
