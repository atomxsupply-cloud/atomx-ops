# Handoff IA Flotante

## Objetivo visual

La IA no debería ocupar la pantalla principal como módulo aparte.

La idea deseada es:

- dashboard y módulos operativos como núcleo de la app
- IA accesible desde cualquier página
- un átomo flotante en la esquina inferior derecha
- al pulsarlo, se abre un panel o drawer de chat

## Comportamiento deseado

- visible en todas las páginas internas autenticadas
- cerrado por defecto
- no romper layout ni navegación principal
- permitir:
  - chat libre
  - interpretar mensaje en pedido
  - voz si ya existe

## Propuesta técnica

- mover `Asistente.jsx` de página principal a widget reutilizable
- dejar `/dashboard` como landing principal
- crear componente tipo `AtomAssistantWidget.jsx`
- integrar el widget en `Layout.jsx`

## Flujo sugerido

1. botón flotante con icono átomo
2. al hacer click, abrir panel lateral o modal grande
3. dos tabs dentro del panel:
   - chat
   - interpretar pedido

## Regla importante

La IA debe sentirse como ayuda contextual del gestor interno, no como módulo separado que compite con el resto de la app.
