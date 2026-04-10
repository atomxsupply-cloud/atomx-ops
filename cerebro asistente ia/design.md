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

