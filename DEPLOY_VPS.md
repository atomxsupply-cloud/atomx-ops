# Deploy ATOM X OPS en VPS — 24 horas

## Tu servidor
- IP: 185.14.58.4
- Usuario: root
- Panel: vm829.dnspropio.com

---

## PASO 1 — Conectar al servidor por SSH

Abre una terminal (PowerShell o CMD) y escribe:

```
ssh root@185.14.58.4
```

Pon la contraseña cuando te la pida.

---

## PASO 2 — Instalar Node.js 24 en el servidor

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
node --version   # debe decir v24.x.x
```

---

## PASO 3 — Instalar PM2 (mantiene la app encendida 24h)

```bash
npm install -g pm2
```

---

## PASO 4 — Instalar Nginx (sirve la web)

```bash
apt-get install -y nginx
```

---

## PASO 5 — Subir el proyecto al servidor

Desde tu ordenador (no desde el servidor), abre una terminal nueva:

```
scp -r "C:\Users\34675\proyecto ia atom x\04-atomx-ops" root@185.14.58.4:/var/www/atomx-ops
```

---

## PASO 6 — Instalar dependencias en el servidor

Vuelve a la terminal del servidor (SSH):

```bash
cd /var/www/atomx-ops/backend
npm install

cd /var/www/atomx-ops/frontend
npm install
npm run build
```

---

## PASO 7 — Configurar variables de entorno

```bash
nano /var/www/atomx-ops/backend/.env
```

Contenido:
```
PORT=3001
JWT_SECRET=atomx_ops_secret_2024_muy_largo_y_seguro
ANTHROPIC_API_KEY=sk-ant-api03-W-zj59Du3rR8-...  (tu clave)
```

Guardar: Ctrl+O → Enter → Ctrl+X

---

## PASO 8 — Arrancar el backend con PM2

```bash
cd /var/www/atomx-ops/backend
pm2 start "node --experimental-sqlite src/index.js" --name atomx-backend
pm2 save
pm2 startup
```

Copia y ejecuta el comando que te dé `pm2 startup`.

---

## PASO 9 — Configurar Nginx

```bash
nano /etc/nginx/sites-available/atomx-ops
```

Pega esto (cambia `atomxops.atomxsupply.com` por el subdominio que quieras usar):

```nginx
server {
    listen 80;
    server_name atomxops.atomxsupply.com;

    # Sirve el frontend (React)
    root /var/www/atomx-ops/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy al backend Node
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

```bash
ln -s /etc/nginx/sites-available/atomx-ops /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

---

## PASO 10 — Apuntar el dominio (opcional)

En tu panel de DNS (donde tengas el dominio atomxsupply.com), añade:

```
Tipo: A
Nombre: atomxops  (o el subdominio que quieras)
Valor: 185.14.58.4
```

En unos minutos entraréis desde el móvil en:
**http://atomxops.atomxsupply.com**

---

## PASO 11 — HTTPS gratis con Let's Encrypt (recomendado)

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d atomxops.atomxsupply.com
```

Sigue los pasos y tendrás HTTPS automático. La URL quedará:
**https://atomxops.atomxsupply.com**

---

## Comandos útiles de mantenimiento

```bash
# Ver si el backend está corriendo
pm2 status

# Ver logs del backend
pm2 logs atomx-backend

# Reiniciar si algo falla
pm2 restart atomx-backend

# Actualizar el proyecto (después de cambios)
cd /var/www/atomx-ops
scp -r desde tu PC...
pm2 restart atomx-backend
cd frontend && npm run build
```

---

## Resumen rápido

| Qué | Dónde |
|-----|-------|
| App web | http://atomxops.atomxsupply.com |
| Backend | localhost:3001 (interno) |
| Base de datos | /var/www/atomx-ops/backend/atomx.db |
| Logs | pm2 logs atomx-backend |
| Reiniciar | pm2 restart atomx-backend |
