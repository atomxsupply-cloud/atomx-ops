# Patrones operativos detectados

## 1. Pedidos escritos como lista suelta

Aparecen muchos mensajes de este tipo:

- `1 bote tinta blanca`
- `Green soap botella grande x2`
- `7 RL 0,25 - 2 cajas`
- `1 bote diluyente`

### Qué necesita el bot

Poder extraer:

- producto
- cantidad
- unidad
- tamaño
- marca
- observaciones

## 2. Confirmaciones muy cortas

Ejemplos:

- `si`
- `okey`
- `d1`
- `perfecto`
- `vale`

### Qué necesita el bot

No pedir demasiada confirmación cuando el contexto ya está claro.

## 3. Frases que implican acción

Se repiten patrones como:

- `quítalo de la web`
- `mándale una`
- `dile que`
- `te paso`
- `haz la factura`
- `mete el envío`

### Qué necesita el bot

Detectar cuándo una frase es:

- tarea
- recordatorio
- instrucción
- envío de dato

## 4. Mucho contexto de producto tatuaje

Se repiten familias de producto como:

- agujas y cartuchos
- tintas negras y blancas
- diluyentes
- stencil
- soaps
- foam
- vaselina
- butter
- botes vacíos
- film
- toallitas

### Qué necesita el bot

Un mini diccionario interno de producto y variantes de escritura.

## 5. Variantes de nombres y errores

Ejemplos típicos:

- `kwadrom` por `kwadron`
- `estencil` por `stencil`
- `dinamik` por `dynamic`
- `manteka` por `manteca`

### Qué necesita el bot

Normalización flexible de términos.

## 6. Conversación mezclada con operación

Los chats no están limpios por tema. Se mezcla:

- bromas
- quedadas
- ubicaciones
- pedidos
- precios
- llamadas

### Qué necesita el bot

Separar lo operativo de lo social para no convertir cualquier mensaje en una tarea.

## 7. Plantillas repetidas

Se detectan frases recurrentes como:

- `Copia este mensaje y me lo mandas relleno porfa`
- `Gracias por tu mensaje !`

### Qué necesita el bot

Poder:

- generar plantillas
- rellenarlas
- convertir mensajes largos en formato estándar

## 8. Mucho valor en búsqueda histórica

Los chats contienen valor histórico sobre:

- precios
- qué se pidió
- qué se dijo a un cliente
- qué productos se tienen o no

### Qué necesita el bot

Un buscador semántico o, como mínimo, un buscador estructurado con:

- fecha
- persona
- producto
- tipo de mensaje

## Casos de uso muy claros

### Caso 1

`búscame todas las veces que pedimos tinta blanca`

### Caso 2

`convierte este mensaje en pedido limpio`

### Caso 3

`resúmeme lo pendiente que dijo Papi esta semana`

### Caso 4

`sácame de este chat solo lo que son productos y cantidades`

### Caso 5

`hazme una respuesta corta en nuestro tono`
