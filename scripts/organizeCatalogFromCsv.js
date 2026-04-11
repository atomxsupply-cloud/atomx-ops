const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INPUT = path.join(ROOT, 'datos', 'catalogo-web', 'product_2026-04-11_141642.csv');
const OUTPUT_DIR = path.join(ROOT, 'datos', 'catalogo-web');

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseCsvLine(line = '') {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ';' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => String(value || '').trim());
}

function detectBrand(category = '', name = '') {
  const cat = normalizeText(category);
  const n = normalizeText(name);

  if (cat === 'eternal ink' || /^eternal\b/.test(n)) return 'ETERNAL';
  if (cat === 'vice colors' || /^vice\b/.test(n)) return 'VICE_COLORS';
  if (cat === 'radiant colors' || /^radiant\b/.test(n)) return 'RADIANT';
  if (cat === 'dynamic' || /^dynamic\b/.test(n)) return 'DYNAMIC';
  if (/^dermaglo\b/.test(n)) return 'DERMAGLO';
  if (/^allegory\b/.test(n)) return 'ALLEGORY';
  if (/^hype\b/.test(n)) return 'HYPE_INK';
  return '';
}

function isWhiteInk(name = '') {
  const n = normalizeText(name);
  return /\b(white|blanco|blanca)\b/.test(n) || /\b(nuclear white|super white|perfect white)\b/.test(n);
}

function isBlackInk(name = '') {
  const n = normalizeText(name);
  return (
    /\b(black|negro|negra)\b/.test(n) ||
    /\b(greywash|graywash|grey wash|gray wash|wash)\b/.test(n) ||
    /\b(grey|gray|gris)\b/.test(n) ||
    /\b(lining|liner|outline|linea)\b/.test(n) ||
    /\btriple black\b/.test(n)
  );
}

function classifyInk(name = '') {
  if (isWhiteInk(name)) return 'blanca';
  if (isBlackInk(name)) return 'negra';
  return 'color';
}

function isInkLike(name = '', category = '') {
  const brand = detectBrand(category, name);
  if (!brand) return false;
  const n = normalizeText(name);
  const blacklist = [
    'aguja', 'cartucho', 'cartridge', 'maquina', 'machine', 'fuente', 'cable',
    'guante', 'grip', 'stencil', 'transfer', 'crema', 'butter', 'vaselina',
    'film', 'wrap', 'mesa', 'carro', 'mueble', 'pedal', 'spray',
  ];
  return !blacklist.some((token) => n.includes(token));
}

function readCsvRows() {
  const raw = fs.readFileSync(INPUT, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  const headerIndex = Object.fromEntries(headers.map((header, i) => [normalizeText(header), i]));

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      id: cols[headerIndex['product id']] || '',
      nombre: cols[headerIndex['nombre']] || '',
      referencia: cols[headerIndex['referencia']] || '',
      categoria: cols[headerIndex['categoria']] || '',
      precio: Number(cols[headerIndex['precio imp incl']] || 0),
      cantidad: cols[headerIndex['cantidad']] === '' ? null : Number(cols[headerIndex['cantidad']]),
      estado: cols[headerIndex['estado']] || '',
      imagen: cols[headerIndex['imagen']] || '',
    };
  }).filter((row) => row.nombre);
}

function groupBy(array, keyFn) {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}

function detectMaterialFamily(row) {
  const category = normalizeText(row.categoria);
  const name = normalizeText(row.nombre);
  const text = `${category} ${name}`.trim();

  if (/tinta artistica|panthera ink|eclipse ink|electric ink|nuclear white/.test(text) || /solid ink|panthera|eclipse|electric ink|pigmento nuclear white/.test(text)) return 'otras_tintas';
  if (/aguja|cartucho|cartridge|kwadron|cheyenne|emalla|bishop|rl|rs|rm|magnum/.test(text)) return 'agujas_y_cartuchos';
  if (/maquina|pen\b|xion|equaliser|vlad blad|hornet|proton|rotary|inalambric|wireless|fk irons|exo\b|flux\b|spektra/.test(text)) return 'maquinas';
  if (/fuente|power|battery|bateria|cable|pedal|rca|clipcord/.test(text)) return 'fuentes_y_energia';
  if (/transfer|freehand|termocopiadora|stencil|papel hectografico|thermal/.test(text)) return 'transfer_y_stencil';
  if (/green soap|limpieza|desinfect|alcohol|foam|soap|jabon|servilleta|esponja|wipz/.test(text)) return 'limpieza_e_higiene';
  if (/crema|curacion|butter|vaselina|aloe|aftercare|balm|ointment/.test(text)) return 'curacion_y_cuidado';
  if (/caps|vasos|botellas|cup|bottle|rinse/.test(text)) return 'caps_y_envases';
  if (/film|funda|plastico|proteccion|barrier|clip cord cover|sleeve|sabana|sobre esterilizacion/.test(text)) return 'proteccion_y_desechables';
  if (/camilla|mueble|carro|mesa|taburete|foco|lampara|maletin|apoyabrazos/.test(text)) return 'mobiliario_y_estudio';
  if (/grip|tip|tubo|tubos|puntera/.test(text)) return 'grips_tubos_y_puntas';
  if (/diluyente|dilucion|diluent|mixing solution/.test(text)) return 'dilucion_y_mezcla';
  if (/piel sintetica|goma|practice skin/.test(text)) return 'practica_y_piel_sintetica';
  if (/guante|glove|mascarilla|razuradora|depresor|campo|piercing|esparadrapo/.test(text)) return 'sanitario_y_preparacion';
  return 'otros_materiales';
}

function main() {
  if (!fs.existsSync(INPUT)) {
    console.error(`No existe el CSV: ${INPUT}`);
    process.exit(1);
  }

  const rows = readCsvRows();
  const tintas = rows
    .filter((row) => isInkLike(row.nombre, row.categoria))
    .map((row) => ({
      ...row,
      marca: detectBrand(row.categoria, row.nombre),
      tipo_tinta: classifyInk(row.nombre),
    }));

  const marcasPrincipales = ['ETERNAL', 'VICE_COLORS', 'RADIANT'];
  const tintasPrincipales = tintas.filter((row) => marcasPrincipales.includes(row.marca));
  const tintasPorMarca = groupBy(tintasPrincipales, (row) => row.marca);
  const materiales = rows.filter((row) => !isInkLike(row.nombre, row.categoria));
  const materialesPorCategoria = groupBy(materiales, (row) => row.categoria || 'Sin categoria');
  const materialesConFamilia = materiales.map((row) => ({
    ...row,
    familia: detectMaterialFamily(row),
  }));
  const materialesPorFamilia = groupBy(materialesConFamilia, (row) => row.familia || 'otros_materiales');

  const resumen = {
    generado_at: new Date().toISOString(),
    origen: path.basename(INPUT),
    total_productos: rows.length,
    total_tintas: tintas.length,
    total_materiales: materiales.length,
    marcas_tinta: Object.fromEntries(
      Object.entries(groupBy(tintas, (row) => row.marca || 'OTROS')).map(([brand, items]) => [brand, items.length])
    ),
    categorias_materiales_top: Object.entries(materialesPorCategoria)
      .map(([categoria, items]) => ({ categoria, total: items.length }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 25),
    familias_materiales: Object.entries(materialesPorFamilia)
      .map(([familia, items]) => ({ familia, total: items.length }))
      .sort((a, b) => b.total - a.total),
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'catalogo_tintas_principales.json'), JSON.stringify(tintasPorMarca, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'catalogo_materiales_por_categoria.json'), JSON.stringify(materialesPorCategoria, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'catalogo_materiales_por_familia.json'), JSON.stringify(materialesPorFamilia, null, 2));
  fs.writeFileSync(path.join(OUTPUT_DIR, 'catalogo_resumen.json'), JSON.stringify(resumen, null, 2));

  console.log(`Resumen generado en ${OUTPUT_DIR}`);
  console.log(JSON.stringify(resumen, null, 2));
}

main();
