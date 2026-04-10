# Integracion Factusol nube

## Objetivo

Conectar ATOM X OPS con FACTUSOL en la nube para leer clientes, articulos, ventas y documentos casi al momento.

## Lo que ya queda preparado en el proyecto

- Servicio base: `backend/src/services/factusolCloud.js`
- Ruta de estado: `GET /api/factusol/status`
- Ruta de prueba de sincronizacion: `POST /api/factusol/sync/clientes`
- Variables de entorno ejemplo añadidas a `backend/.env.example`

## Credenciales que hacen falta

- `FACTUSOL_MANUFACTURER_CODE`
- `FACTUSOL_CLIENT_ID`
- `FACTUSOL_CLIENT_SECRET`
- `FACTUSOL_DATABASE_ID`
- opcional: `FACTUSOL_API_BASE_URL`

## Como conseguirlas

1. Darse de alta como desarrollador/fabricante en Software DELSOL
   - Web oficial API: `https://www.sdelsol.com/api/`

2. Activar el acceso por API en FACTUSOL nube
   - Ayuda oficial: `https://ayuda.teamsystem.es/hc/es/articles/32074471063057-FACTUSOL-Acceso-por-API`

3. Crear el acceso API desde FACTUSOL
   - Dar permisos a las tablas o modulos que vayamos a usar
   - Guardar el identificador de la base o empresa conectada

## Siguiente desarrollo cuando tengamos credenciales

1. Confirmar endpoint OAuth real
2. Sacar token automaticamente
3. Sincronizar clientes
4. Sincronizar articulos
5. Sincronizar documentos
6. Crear boton de "Sincronizar Factusol" dentro de ATOM X OPS

## Pendiente

- Confirmar con prueba real el endpoint exacto de autenticacion
- Confirmar si FACTUSOL nube expone clientes y articulos en el mismo paquete API
- Definir si la sincronizacion sera manual, programada o ambas
