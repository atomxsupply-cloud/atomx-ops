# ATOM X OPS — Instrucciones de arranque

## Stack
- **Backend**: Node.js + Express + SQLite (sin servidor de BD separado)
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: JWT (30 días)
- **Deploy**: VPS Linux con PM2

---

## Arrancar en local (desarrollo)

### 1. Backend
```bash
cd backend
cp .env.example .env
# Edita .env y pon un JWT_SECRET largo y aleatorio
npm install
npm run dev
# Corre en http://localhost:3001
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# Corre en http://localhost:5173
```

Abre http://localhost:5173 en el navegador.

### Usuarios por defecto
| Nombre   | Email                  | Contraseña  | Rol        |
|----------|------------------------|-------------|------------|
| Juanfran | juanfran@atomx.com     | atomx2024   | admin      |
| Juanje   | juanje@atomx.com       | atomx2024   | encargado  |
| Papi     | papi@atomx.com         | atomx2024   | empleado   |

**IMPORTANTE: Cambia las contraseñas en producción.**

---

## Desplegar en el VPS (producción)

### Requisitos en el VPS
```bash
# Instalar Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2
npm install -g pm2
```

### Subir el proyecto
```bash
# Desde tu ordenador, copia el proyecto al VPS
scp -r "04-atomx-ops" root@185.14.58.4:/var/www/atomx-ops

# O usa git si lo tienes en un repo
```

### Configurar backend en el VPS
```bash
cd /var/www/atomx-ops/backend
cp .env.example .env
nano .env
# Pon: JWT_SECRET=una_clave_muy_larga_y_secreta_aqui

npm install --production
```

### Build del frontend
```bash
cd /var/www/atomx-ops/frontend
npm install
npm run build
# Genera la carpeta dist/
```

### Arrancar con PM2
```bash
cd /var/www/atomx-ops/backend
pm2 start src/index.js --name atomx-backend
pm2 save
pm2 startup
```

### Nginx (para servir frontend y hacer proxy del backend)
```nginx
server {
    listen 80;
    server_name tu-dominio.com;  # O la IP del VPS

    # Frontend (archivos estáticos)
    root /var/www/atomx-ops/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nano /etc/nginx/sites-available/atomx-ops
# Pega la configuración de arriba
sudo ln -s /etc/nginx/sites-available/atomx-ops /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## Estructura del proyecto

```
04-atomx-ops/
├── backend/
│   ├── src/
│   │   ├── index.js          # Entrada del servidor
│   │   ├── db.js             # SQLite + esquema + seed
│   │   ├── middleware/
│   │   │   └── auth.js       # JWT middleware
│   │   └── routes/
│   │       ├── auth.js       # Login, /me, usuarios
│   │       ├── dashboard.js  # Stats del panel principal
│   │       ├── pedidos.js    # CRUD pedidos
│   │       ├── tareas.js     # CRUD tareas
│   │       ├── notas.js      # CRUD notas
│   │       ├── stock.js      # CRUD productos/stock
│   │       ├── caja.js       # Caja diaria
│   │       └── checklist.js  # Checklist apertura/cierre
│   ├── atomx.db              # Base de datos SQLite (se crea automáticamente)
│   ├── .env                  # Variables de entorno (no subir a git)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api/client.js     # Axios configurado
    │   ├── context/AuthContext.jsx
    │   ├── components/
    │   │   ├── Layout.jsx
    │   │   ├── Sidebar.jsx
    │   │   ├── Modal.jsx
    │   │   └── Checklist.jsx
    │   └── pages/
    │       ├── Login.jsx
    │       ├── Dashboard.jsx
    │       ├── Pedidos.jsx
    │       ├── Tareas.jsx
    │       ├── Notas.jsx
    │       ├── Stock.jsx
    │       └── Caja.jsx
    └── package.json
```

---

## Módulos del MVP

| Módulo | Qué hace |
|--------|----------|
| **Dashboard** | Vista general: pedidos, tareas, caja, notas fijadas, urgentes, actividad, checklist |
| **Pedidos** | Crear/ver/filtrar pedidos con cliente, productos, estado, urgencia |
| **Tareas** | Lista de tareas por prioridad, asignadas, con fecha límite y recurrencia |
| **Notas** | Pizarra del equipo, notas fijables que aparecen en el dashboard |
| **Stock** | Inventario con alertas de stock bajo, edición rápida en tabla |
| **Caja** | Apertura/cierre con cuadre automático, movimientos del día |
| **Checklist** | Apertura y cierre del día con progreso visual |

---

## Las 8 funcionalidades añadidas (ya implementadas)

1. **Checklist apertura/cierre** — en Dashboard, con progreso y hora de cada paso
2. **Resumen diario automático** — Dashboard con todos los KPIs del día
3. **Aviso de stock bajo** — alerta visual en tabla y badge en Dashboard
4. **Pedidos urgentes destacados** — borde rojo, badge, filtro rápido, sección en Dashboard
5. **Incidencias separadas** — estado "incidencia" en pedidos + tabla en BD
6. **Caja con descuadre automático** — calcula diferencia esperado vs real al cerrar
7. **Historial quién toca qué** — tabla `actividad` registra todo cambio con usuario y hora
8. **Tareas recurrentes** — flag en tabla de tareas, visible con icono en la lista
