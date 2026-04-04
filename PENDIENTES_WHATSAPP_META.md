# Pendientes WhatsApp Meta

Estado actual: `bloqueado por falta de acceso a Meta Developers`

## Lo que ya esta hecho

- webhook backend creado en `/api/whatsapp/webhook`
- verificacion de webhook preparada
- guardado de mensajes de WhatsApp en base de datos
- IA conectada para interpretar mensajes
- creacion automatica de tareas y pedidos
- zonas de reparto conectadas
- notificaciones internas al asignado

## Lo que falta cuando haya acceso a Meta

1. Entrar en `developers.facebook.com`
2. Abrir la app de WhatsApp Business / Cloud API
3. Ir a `WhatsApp > Configuration` o `WhatsApp > API Setup`
4. Configurar Webhook

Callback URL prevista:

`http://185.14.58.4:3001/api/whatsapp/webhook`

Nota:
- si Meta no acepta `http` o IP con puerto, habra que poner dominio con `https`
- objetivo recomendado: `https://ops.atomxsupply.com/api/whatsapp/webhook`

5. Poner el verify token igual que en `backend/.env`

Variables necesarias:

- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`

6. Suscribirse al evento:

- `messages`

7. Hacer primera prueba real desde WhatsApp con algo como:

`crea tarea para juanje preparar pedidos de zona playa`

## Comprobaciones despues de activarlo

- verificar que entra el mensaje en `whatsapp_messages`
- verificar que la IA responde
- verificar que crea tarea o pedido
- verificar que el asignado recibe notificacion interna

## Siguiente fase recomendada

- procesar audios / notas de voz
- transcripcion automatica
- respuestas cortas pensadas para conduccion
- comandos tipo `mis tareas`, `mis pedidos`, `resumen del dia`
