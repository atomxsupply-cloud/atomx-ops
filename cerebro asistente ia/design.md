# Design y herramientas cliente

## Replicar "photo to pattern" para clientes

Objetivo:
- crear dentro del ecosistema ATOM X una herramienta tipo `photograph to pattern`
- pensada para clientes y tatuadores
- convertir imagen/foto en plantilla limpia o base de stencil

Referencia funcional:
- `https://online.rapidresizer.com/photograph-to-pattern.php`

Lo que debe hacer ATOM X:
- subir foto
- limpiar fondo o ruido
- pasar a blanco/negro
- controlar contraste
- controlar umbral
- marcar bordes
- suavizar o endurecer lineas
- vista previa rapida en movil
- exportar PNG limpio
- opcion futura para exportar PDF / impresion

Enfoque recomendado:
1. version 1 dentro de `atomx-design`
2. procesamiento en navegador para que vaya rapido
3. presets rapidos:
   - stencil fino
   - stencil medio
   - blackwork
   - realismo base
4. boton para abrir resultado en ops y guardarlo a cliente/proyecto

Reglas de producto:
- debe sentirse premium y rapido
- cero pasos inutiles
- muy usable en movil
- pensado para ayudar a vender y preparar mejor el trabajo del cliente

## Criterio visual para recomendaciones de tinta

La herramienta de color no debe comportarse como un selector rigido por pixel.
Debe usar la tecnica como base, pero decidir con criterio visual de tatuador.

Prioridades:
1. lectura general de la pieza
2. volumen y profundidad
3. armonia entre zonas
4. contraste util
5. fidelidad al color base
6. saturacion/intensidad

Normas utiles:
- no copiar solo el color visible
- interpretar la funcion de cada zona: base, sombra, transicion, luz, linea o espacio de respiro
- una sombra no siempre significa negro
- una luz no siempre significa blanco
- una transicion buena puede pesar mas que acertar el tono exacto
- dos zonas parecidas pueden pedir tintas distintas si cumplen funciones distintas
- si una excepcion mejora claramente la lectura final, permitirla

Lo que debe evitar:
- pintar por reglas literales
- tratar cada zona como aislada
- oscurecer por sistema todo lo que va atras
- usar negro como solucion rapida para todo

Frase central:
- usar las reglas como conocimiento base, pero decidir como un ojo artistico entrenado
