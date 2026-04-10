# Deploy VPS ATOM X OPS + ATOM X Design

## Objetivo

- `OPS` en VPS con `pm2`
- `Design` en el mismo VPS servido por `nginx`
- 2 subdominios
- SSL con `certbot`

## Estructura final

```text
/var/www/atomx-ops
  backend/
  frontend/

/var/www/atomx-design
  index.html
  api/ (solo referencia local, no hace falta ejecutarlo en VPS)
```

## Subdominios

- `ops.atomxsupply.com` -> app interna `ATOM X OPS`
- `design.atomxsupply.com` -> app `ATOM X Design`

## 1. Instalar base

```bash
apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
npm install -g pm2
```

## 2. Subir proyectos

```bash
mkdir -p /var/www
```

Desde tu PC:

```powershell
scp -r "C:\Users\34675\proyecto ia atom x\04-atomx-ops" root@185.14.58.4:/var/www/atomx-ops
scp -r "C:\Users\34675\proyecto ia atom x\02-atomx-design\*" root@185.14.58.4:/var/www/atomx-design
```

## 3. Preparar OPS

```bash
cd /var/www/atomx-ops/backend
npm install
```

Crear `.env`:

```bash
nano /var/www/atomx-ops/backend/.env
```

Contenido minimo:

```env
NODE_ENV=production
PORT=3001
JWT_SECRET=cambia_esto_por_un_secret_largo
ANTHROPIC_API_KEY=tu_clave_anthropic
OPENAI_API_KEY=si_la_vas_a_usar
PRESTASHOP_BASE_URL=si_lo_tienes
PRESTASHOP_WS_KEY=si_lo_tienes
```

## 4. Build de OPS frontend

```bash
cd /var/www/atomx-ops/frontend
npm install
npm run build
```

## 5. Arrancar backend con PM2

```bash
cd /var/www/atomx-ops
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

Ejecuta tambien el comando que te devuelva `pm2 startup`.

## 6. Configurar nginx

Copiar config:

```bash
cp /var/www/atomx-ops/deploy/nginx/atomx-stack.conf /etc/nginx/sites-available/atomx-stack
ln -s /etc/nginx/sites-available/atomx-stack /etc/nginx/sites-enabled/atomx-stack
nginx -t
systemctl reload nginx
```

## 7. DNS

Crea dos registros `A` apuntando a la IP del VPS:

- `ops.atomxsupply.com`
- `design.atomxsupply.com`

## 8. SSL

```bash
certbot --nginx -d ops.atomxsupply.com -d design.atomxsupply.com
```

## 9. Como funciona Design en VPS

`ATOM X Design` sigue pidiendo:

- `/api/catalog`
- `/api/analyze`

Pero en este despliegue `nginx` los redirige al backend vivo de `OPS`:

- `/api/catalog` -> `/api/public/eternal/catalogo`
- `/api/analyze` -> `/api/public/design/analyze`

Asi no dependes de Vercel para nada.

## 10. Mantenimiento

```bash
pm2 status
pm2 logs atomx-ops
pm2 restart atomx-ops
systemctl reload nginx
certbot renew --dry-run
```
