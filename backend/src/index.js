const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { init } = require('./db');
const { auth } = require('./middleware/auth');
const { requireSection } = require('./middleware/access');
const { securityHeaders } = require('./middleware/security');
const { importClientesFactusol, CLIENTES_XLSX_PATH } = require('./services/clientesFactusol');

const app = express();
const PORT = process.env.PORT || 3001;

app.disable('x-powered-by');
app.use(cors());
app.use(securityHeaders);
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Rutas API
app.use('/api/public', require('./routes/public'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/pedidos', auth, requireSection('pedidos'), require('./routes/pedidos'));
app.use('/api/tareas', auth, requireSection('tareas'), require('./routes/tareas'));
app.use('/api/notas', auth, requireSection('notas'), require('./routes/notas'));
app.use('/api/clientes', auth, requireSection('clientes'), require('./routes/clientes'));
app.use('/api/search', auth, requireSection('buscador'), require('./routes/search'));
app.use('/api/stock', auth, requireSection('stock'), require('./routes/stock'));
app.use('/api/prestashop', auth, requireSection('prestashop'), require('./routes/prestashop'));
app.use('/api/factusol', auth, requireSection('factusol'), require('./routes/factusol'));
app.use('/api/caja', auth, requireSection('caja'), require('./routes/caja'));
app.use('/api/salidas', auth, requireSection('salidas'), require('./routes/salidas'));
app.use('/api/checklist', auth, requireSection('checklist'), require('./routes/checklist'));
app.use('/api/notificaciones', require('./routes/notificaciones'));
app.use('/api/ia', auth, requireSection('ia'), require('./routes/ia'));
app.use('/api/rutas', auth, requireSection('rutas'), require('./routes/rutas'));
app.use('/api/maps', auth, requireSection('rutas'), require('./routes/maps'));
app.use('/api/fichajes', auth, requireSection('fichajes'), require('./routes/fichajes'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/direccion', auth, requireSection('direccion'), require('./routes/direccion'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Servir frontend React (en producción)
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Iniciar BD y arrancar
init();

try {
  const result = importClientesFactusol();
  if (result.imported > 0) {
    console.log(`Clientes Factusol conectados al sistema: ${result.imported} importados desde ${CLIENTES_XLSX_PATH}`);
  } else {
    console.log('No he encontrado clientes de Factusol para importar automaticamente al arrancar.');
  }
} catch (error) {
  console.error('No he podido conectar los clientes de Factusol al arrancar:', error.message);
}

app.listen(PORT, '0.0.0.0', () => console.log(`ATOM X OPS backend corriendo en puerto ${PORT}`));
