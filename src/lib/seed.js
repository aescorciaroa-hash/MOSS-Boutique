// Datos base del sistema. El catálogo (nombres, precios y fotos) proviene del catálogo de MOSS Boutique.
// No hay datos de prueba: el stock y los costos se cargan desde Inventario, y los clientes se registran en la tienda.

export const CATEGORIES = [
  { id: 'bodys', name: 'Bodys', prefix: 'BOD' },
  { id: 'blusas', name: 'Blusas y corsets', prefix: 'BLU' },
  { id: 'vestidos', name: 'Vestidos', prefix: 'VES' },
  { id: 'faldas', name: 'Faldas', prefix: 'FAL' },
  { id: 'jeans', name: 'Jeans', prefix: 'JEA' },
  { id: 'accesorios', name: 'Accesorios', prefix: 'ACC' },
]

export const PAYMENT_METHODS = [
  { id: 'efectivo', name: 'Efectivo' },
  { id: 'transferencia', name: 'Transferencia' },
  { id: 'nequi', name: 'Nequi' },
  { id: 'daviplata', name: 'Daviplata' },
  { id: 'tarjeta', name: 'Tarjeta' },
]

export const COLORS = {
  Negro: '#151515',
  Café: '#6b4430',
  Blanco: '#f4f2ed',
  Beige: '#e3cfae',
  Celeste: '#9fc9ee',
  Rosa: '#f29db1',
  Vino: '#7f1d2d',
  Rojo: '#c81d33',
  Amarillo: '#efe9a8',
  Dorado: '#cfa448',
  Plata: '#c5c9cf',
  'Azul oscuro': '#1f2b4a',
  'Azul claro': '#6f93c6',
  Estampado: '#a98762',
}

// [categoría, tipo, nombre, precio, foto, colores, tallas]
const RAW = [
  ['bodys', 'Body cuello', 'Maya', 35000, 'p05_1', ['Celeste', 'Café', 'Blanco']],
  ['bodys', 'Body', 'Suprema', 35000, 'p05_3', ['Negro', 'Café', 'Blanco']],
  ['bodys', 'Body cuello', 'Blonda', 35000, 'p06_1', ['Blanco', 'Negro']],
  ['bodys', 'Body', 'Básico Moño', 35000, 'p06_2', ['Rosa', 'Negro', 'Blanco']],
  ['bodys', 'Body', 'Combinado', 45000, 'p06_3', ['Café', 'Negro']],
  ['bodys', 'Body', 'Copa Blonda', 70000, 'p07_1', ['Café', 'Negro']],
  ['bodys', 'Body copa', 'Mar', 65000, 'p07_2', ['Café', 'Negro']],
  ['bodys', 'Body', 'Manga', 65000, 'p07_3', ['Café', 'Negro']],
  ['bodys', 'Body', 'Copa José', 55000, 'p08_1', ['Café', 'Negro']],
  ['bodys', 'Body moño', 'Bandeja', 40000, 'p08_2', ['Negro', 'Café']],
  ['bodys', 'Body blonda', 'Costillero', 40000, 'p09_1', ['Negro']],
  ['bodys', 'Body', 'Capricho', 70000, 'p09_2', ['Negro']],
  ['bodys', 'Body', 'Design', 35000, 'p09_3', ['Negro', 'Café']],
  ['bodys', 'Body', 'Top Runche', 35000, 'p10_1', ['Negro']],
  ['bodys', 'Body', 'Auténtica', 60000, 'p10_2', ['Negro']],
  ['bodys', 'Body', 'Milán', 60000, 'p10_3', ['Negro']],
  ['bodys', 'Body malla', 'Brillante', 50000, 'p11_1', ['Vino', 'Negro']],
  ['bodys', 'Body básico', 'Estraple', 35000, 'p11_2', ['Amarillo', 'Negro', 'Blanco']],
  ['bodys', 'Body', 'Básico', 35000, 'p11_3', ['Beige', 'Negro', 'Blanco']],
  ['bodys', 'Body', 'Básico Manga Corta', 35000, 'p12_1', ['Café', 'Negro', 'Blanco']],
  ['bodys', 'Body malla tex', 'Escote', 25000, 'p19_2', ['Celeste', 'Blanco']],
  ['blusas', 'Blusa', 'Hebilla', 40000, 'p05_2', ['Beige', 'Negro', 'Café']],
  ['blusas', 'Blusa escotada', 'Capullo', 40000, 'p12_2', ['Negro', 'Café']],
  ['blusas', 'Blusa', 'Bandeja', 35000, 'p12_3', ['Celeste', 'Negro', 'Blanco']],
  ['blusas', 'Blusa brillo', 'Mariposa', 33000, 'p13_1', ['Negro', 'Dorado']],
  ['blusas', 'Corset', 'Encaje', 55000, 'p13_2', ['Negro']],
  ['blusas', 'Blusa corta', 'Tiras', 25000, 'p13_3', ['Blanco', 'Negro']],
  ['blusas', 'Corset', 'Estraple', 55000, 'p08_3', ['Negro']],
  ['blusas', 'Blusa', 'Malla', 35000, 'p19_1', ['Negro']],
  ['vestidos', 'Vestido', 'Kloe', 80000, 'p19_3', ['Beige', 'Negro']],
  ['vestidos', 'Vestido', 'Ángel Largo', 85000, 'p20_1', ['Beige', 'Negro']],
  ['vestidos', 'Vestido', 'Aitara', 65000, 'p20_2', ['Vino', 'Negro']],
  ['vestidos', 'Vestido', 'Rubí', 65000, 'p20_3', ['Negro']],
  ['vestidos', 'Vestido', 'Alma', 80000, 'p21_1', ['Negro']],
  ['vestidos', 'Vestido', 'Kendal', 70000, 'p21_2', ['Blanco', 'Negro']],
  ['vestidos', 'Vestido', 'Shantal', 85000, 'p21_3', ['Beige']],
  ['vestidos', 'Vestido', 'Ariel', 75000, 'p22_1', ['Vino', 'Negro']],
  ['vestidos', 'Vestido', 'Catalina', 60000, 'p23_1', ['Negro']],
  ['vestidos', 'Vestido', 'Valeria', 75000, 'p23_2', ['Blanco', 'Beige']],
  ['faldas', 'Falda', 'Globo', 20000, 'p18_2', ['Negro']],
  ['faldas', 'Falda short', 'Georgina', 55000, 'p23_3', ['Negro']],
  ['jeans', 'Jean bota tubo', 'Durazno Oscuro', 110000, 'p24_1', ['Azul oscuro'], ['8', '10', '12']],
  ['jeans', 'Jean bota tubo', 'Durazno Pañoleta', 110000, 'p24_2', ['Azul oscuro'], ['12']],
  ['jeans', 'Jean bota tubo', 'Durazno Negro', 110000, 'p24_3', ['Negro'], ['10', '12', '14']],
  ['jeans', 'Jean bota tubo', 'Durazno Claro', 110000, 'p25_2', ['Azul claro'], ['8', '10']],
  ['accesorios', 'Pañoleta', 'Gregoria', 23000, 'p14_1', ['Estampado']],
  ['accesorios', 'Pañoleta', 'Monograma', 23000, 'p14_2', ['Estampado']],
  ['accesorios', 'Pañoleta', 'Animal Print', 23000, 'p14_3', ['Estampado']],
  ['accesorios', 'Pañoleta', 'Monograma Mediana', 20000, 'p15_1', ['Estampado']],
  ['accesorios', 'Pañoleta', 'Corta', 20000, 'p22_2', ['Estampado']],
  ['accesorios', 'Pañoleta', 'Larga', 23000, 'p22_3', ['Estampado']],
  ['accesorios', 'Collar', 'Big Corazón', 23000, 'p15_2', ['Blanco', 'Dorado']],
  ['accesorios', 'Collar', 'Trébol', 16000, 'p15_3', ['Negro', 'Blanco', 'Rojo']],
  ['accesorios', 'Collar', 'Ojo Turco', 25000, 'p18_3', ['Dorado']],
  ['accesorios', 'Aretes', 'Flor White', 15000, 'p16_1', ['Blanco']],
  ['accesorios', 'Aretes', 'Ser Trébol', 22500, 'p17_1', ['Dorado']],
  ['accesorios', 'Pulsera', 'Charms', 18000, 'p16_2', ['Plata']],
  ['accesorios', 'Anillo', 'Corazón', 15000, 'p17_2', ['Plata']],
  ['accesorios', 'Cinturón', 'Concho', 35000, 'p16_3', ['Café', 'Blanco', 'Negro']],
]

// Catálogo inicial de la boutique: productos y fotos reales; stock y costo en 0 para cargarlos desde Inventario.
export function buildCatalog() {
  const counters = {}
  return RAW.map(([category, type, name, price, img, colors, sizes = ['Única']]) => {
    const cat = CATEGORIES.find((c) => c.id === category)
    counters[category] = (counters[category] || 0) + 1
    const sku = `${cat.prefix}-${String(counters[category]).padStart(3, '0')}`
    const isAcc = category === 'accesorios'
    const variants = []
    colors.forEach((color, ci) =>
      sizes.forEach((size, si) =>
        variants.push({
          id: `${sku}-${ci}${si}`,
          color,
          size,
          stock: 0,
        })
      )
    )
    return {
      id: sku.toLowerCase(),
      sku,
      category,
      type,
      name,
      price,
      cost: 0,
      image: `/img/${img}.jpg`,
      variants,
      minStock: isAcc ? 1 : 2,
      active: true,
      createdAt: new Date().toISOString(),
    }
  })
}

export const DEFAULT_SETTINGS = {
  storeName: 'MOSS Boutique',
  legalName: 'MOSS Boutique',
  nit: '',
  address: 'Tienda virtual · Envíos a toda Colombia',
  phone: '311 472 5714',
  instagram: '@moss_boutique',
  receiptFooter:
    'Cambios dentro de 8 días calendario con etiquetas y sin uso. No aplica para bodys, prendas íntimas, prendas blancas ni artículos en promoción. Garantía de 30 días por defectos de fábrica.',
  taxRate: 0,
  nextSaleNumber: 1,
  taxRegime: 'No responsable de IVA',
  invoicePrefix: 'FV',
  resolution: '',
  paperWidth: '80',
  showBarcode: true,
  invoiceTitle: 'FACTURA DE VENTA',
  invoiceThanks: '¡GRACIAS POR SU COMPRA!',
  invoiceSignature: 'MOSS · Tienda en línea',
  defaultDoc: '222222222222',
  showSeller: true,
  showCustomerDoc: true,
  showChannel: true,
  showPrintedAt: true,
  goalsEnabled: true,
  goalDay: 500000,
  goalWeek: 3500000,
  goalMonth: 15000000,
}

export const ACCENTS = [
  { id: 'onyx', name: 'Negro ónix', color: '#18181b' },
  { id: 'nude', name: 'Azul Chronos', color: '#3B82F6' },
  { id: 'navy', name: 'Azul marino', color: '#1e40af' },
  { id: 'slate', name: 'Pizarra', color: '#475569' },
  { id: 'emerald', name: 'Esmeralda', color: '#047857' },
  { id: 'wine', name: 'Borgoña', color: '#9f1239' },
  { id: 'indigo', name: 'Índigo', color: '#4f46e5' },
]

export const CHANNELS = ['Tienda en línea', 'WhatsApp', 'Instagram']
