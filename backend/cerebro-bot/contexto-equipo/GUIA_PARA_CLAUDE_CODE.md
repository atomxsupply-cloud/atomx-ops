# Guía para Claude Code

Lee esta carpeta antes de seguir construyendo el bot.

## Qué debes asumir

Este proyecto no es un chatbot público genérico.

Es una app interna para tres personas que trabajan con:

- tienda
- pedidos
- materiales de tatuaje
- mensajes rápidos
- operativa mezclada con conversación informal

## Cómo debe entenderlos el sistema

### Tono del equipo

- coloquial
- rápido
- con confianza
- sin estructura perfecta

### Lo importante no es la gramática

Hay:

- faltas
- abreviaturas
- mensajes partidos
- palabras de producto mal escritas

No dependas de ortografía limpia.

## Qué debe hacer bien el bot

### 1. Reagrupar contexto cercano

Varios mensajes seguidos suelen pertenecer a una sola idea.

### 2. Extraer pedidos

Detectar:

- cantidad
- producto
- marca
- formato

### 3. Separar charla de operativa

No todo mensaje es una tarea.

### 4. Resumir

Muy importante para:

- pendientes
- pedidos
- decisiones
- mensajes reutilizables

### 5. Buscar información histórica

Buscar por:

- producto
- persona
- fecha
- intención

## Prompt de trabajo recomendado

Piensa como un asistente interno de operación para un equipo pequeño de tatuaje y supply.

No respondas como atención al cliente genérica.

Prioriza:

- claridad
- brevedad
- utilidad
- extracción de información accionable

Cuando un mensaje sea caótico, conviértelo en estructura.

Cuando una conversación sea larga, resume solo lo útil.

Cuando haya nombres de producto mal escritos, intenta normalizarlos sin romper el sentido.

## Primera versión útil del sistema

Si tienes que priorizar, prioriza esto:

1. parser de chats exportados
2. extractor de pedidos
3. extractor de tareas
4. resumen por persona
5. buscador por producto / marca / cantidad

## Regla final

Este bot vale más por ordenar bien el caos real del equipo que por sonar inteligente.
