# WhatsApp + ATOM X OPS

## Objetivo

Conectar un chat oficial de WhatsApp con `atomx-ops` para:

- crear tareas desde el movil
- asignarlas a Juanje, Papi o Juanfran
- crear pedidos rapidos
- marcar zonas de reparto
- responder con la IA sin entrar a la app

## Lo que ya queda montado

- webhook de verificacion Meta: `/api/whatsapp/webhook`
- recepcion de mensajes entrantes
- guardado de mensajes en `whatsapp_messages`
- respuesta automatica por WhatsApp
- ejecucion basica:
  - crear tareas
  - crear pedidos
  - detectar zona de reparto
  - avisar al asignado con notificacion interna

## Variables necesarias

Usar como base:

- `backend/.env.whatsapp.example`

Y llevarlas a `backend/.env`:

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

## URL de webhook en Meta

Ejemplo:

`https://ops.atomxsupply.com/api/whatsapp/webhook`

## Comandos que ya tienen sentido

- `crea tarea para juanje preparar pedidos de zona playa`
- `asigna a papi llamar a Alberto`
- `pedido urgente zona cartagena para Marta 2 dynamic black grandes`
- `que tareas tengo hoy`
- `resumeme lo pendiente`

## Recomendacion operativa

Poned el numero de WhatsApp de cada usuario en la tabla `users.whatsapp_numero`.
Asi el sistema sabe quien esta mandando el mensaje.

## Limite actual

Ahora mismo el webhook procesa texto.
Los audios se dejan preparados como siguiente fase para:

1. descargar media desde Meta
2. transcribir audio
3. pasar la transcripcion al mismo cerebro

## Siguiente fase recomendada

- audios y notas de voz
- comandos de reparto mas finos
- confirmacion antes de crear pedidos grandes
- resumen diario por WhatsApp
- plantillas rapidas: `mis tareas`, `mis pedidos`, `stock bajo`

## Bloqueo actual

Ahora mismo falta acceso a Meta Developers para terminar la activacion real del webhook.

Pendiente guardado en:

- `04-atomx-ops/PENDIENTES_WHATSAPP_META.md`
