// Genera catalogo-procesado.json a partir del CSV de Prestashop
const fs = require('fs');
const path = require('path');

const csv = fs.readFileSync(path.join(__dirname, 'catalogo-productos.csv'), 'latin1');
const lineas = csv.split('\n').slice(1).filter(l => l.trim());

// Marcas/palabras clave que identifican TINTAS (máximo 10% descuento)
const KEYWORDS_TINTA = [
  'dynamic', 'radiant', 'vice color', 'vice vicious', 'vice el gato', 'vice bleeding',
  'dermaglo', 'hype ink', 'allegory', 'kwadron inx', 'world famous', 'panthera ink',
  'obake sumi', 'easy glow', 'eclipse', 'eternal', 'set radiant', 'set dynamic',
  'greywash', 'tinta', ' ink ', 'ink 2', 'ink 3', 'perma blend', 'tina davies',
  'turbo black', 'dynamic black', 'dynamic white', 'dynamic triple',
  'vice colors by', 'vice colors bleeding', 'vice colors criminal'
];

function esTinta(nombre, categoria) {
  const n = (nombre + ' ' + (categoria || '')).toLowerCase();
  return KEYWORDS_TINTA.some(k => n.includes(k));
}

const productos = [];

for (const linea of lineas) {
  // Parsear CSV con punto y coma
  const cols = [];
  let current = '';
  let inQuote = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') { inQuote = !inQuote; continue; }
    if (c === ';' && !inQuote) { cols.push(current.trim()); current = ''; continue; }
    current += c;
  }
  cols.push(current.trim());

  if (cols.length < 7) continue;
  const [id, img, nombre, ref, categoria, precioSinIva, precioConIva, cantidad, estado] = cols;
  if (!nombre || nombre === 'Nombre') continue;

  const precio = parseFloat(precioConIva) || 0;
  if (precio <= 0) continue;

  const tinta = esTinta(nombre, categoria);

  productos.push({
    id: parseInt(id),
    nombre: nombre.replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó').replace(/Ã©/g, 'é').replace(/Ã/g, 'Á').replace(/Ã±/g, 'ñ').replace(/Ã/g, 'Í'),
    ref,
    categoria: categoria || 'General',
    precioSinIva: parseFloat(precioSinIva) || 0,
    precioConIva: precio,
    cantidad: parseInt(cantidad) || 0,
    activo: estado === '0',
    tinta,
    descuentoMaximo: tinta ? 10 : null,
  });
}

const tintas = productos.filter(p => p.tinta);
const resto = productos.filter(p => !p.tinta);

const resultado = {
  generado: new Date().toISOString(),
  total: productos.length,
  totalTintas: tintas.length,
  reglaDescuentoTintas: 'MÁXIMO 10% de descuento en tintas. Nunca superar este límite.',
  productos,
};

fs.writeFileSync(path.join(__dirname, 'catalogo-procesado.json'), JSON.stringify(resultado, null, 2));
console.log(`✅ ${productos.length} productos procesados. ${tintas.length} tintas detectadas.`);
console.log('Tintas (máx 10% dto):');
tintas.slice(0, 10).forEach(t => console.log(`  - ${t.nombre} → ${t.precioConIva}€`));
