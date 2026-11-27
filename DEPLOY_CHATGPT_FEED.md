# Catálogo de Atom X Supply para ChatGPT

La tarea consulta la API de PrestaShop y las fichas públicas en español. Publica un CSV completo por la URL de AtomX Ops cada seis horas. El catálogo se prepara para **España y EUR**. Confirma que el perfil de Atom X Supply admite esa combinación en Business Hub antes de publicar el archivo. El formato estándar de OpenAI usa EE. UU. como mercado por defecto.

## Primera validación en el VPS

Usa Node 24 y la ruta `/var/www/atomx-ops` del [despliegue de AtomX Ops](DEPLOY_VPS_STACK.md). Ejecuta la tarea con el mismo usuario que ejecuta el backend en PM2. Pide una clave dedicada a PrestaShop con permiso GET sobre `products` y `combinations`, y guárdala en `backend/.env` del VPS.

```dotenv
CHATGPT_FEED_ENABLED=0
CHATGPT_FEED_PRESTASHOP_WS_KEY=
CHATGPT_FEED_PRODUCT_IDS=11866
```

El ID inicial corresponde a Musotoku Mercury M2 y permite comprobar las variantes antes de ampliar la selección. Añade IDs de producto separados por comas. Para incluir automáticamente los productos nuevos de categorías revisadas, añade sus segmentos de URL en `CHATGPT_FEED_CATEGORIES`, también separados por comas. Cada artículo necesita una marca publicada, una descripción y una imagen accesible.

```bash
cd /var/www/atomx-ops/backend
node scripts/refreshOpenaiProductFeed.js --check
```

La prueba consulta los precios con IVA de PrestaShop y los compara con las ofertas públicas en EUR. Si difieren, comprueba el contexto de visitante, España y EUR en PrestaShop. Los identificadores opcionales `CHATGPT_FEED_PRESTA_GROUP_ID`, `CHATGPT_FEED_PRESTA_COUNTRY_ID` y `CHATGPT_FEED_PRESTA_CURRENCY_ID` permiten fijar ese contexto. El CSV se genera con identificadores estables por artículo y variante, precio habitual, precio de oferta y disponibilidad. Precio y stock se pueden volver a comprobar en las fichas antes de ampliar la selección.

## Activación

Después de confirmar el mercado de la cuenta y de completar una prueba con la API de producción, establece `CHATGPT_FEED_ENABLED=1` en el archivo de entorno del VPS. Sustituye `usuario-ops` por el usuario del backend. En el ejemplo, el proceso PM2 se llama `atomx-ops`.

```bash
cd /var/www/atomx-ops
sudo install -m 0644 deploy/systemd/atomx-chatgpt-feed@.service \
  deploy/systemd/atomx-chatgpt-feed@.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start atomx-chatgpt-feed@usuario-ops.service
pm2 restart atomx-ops
curl -fsSI https://ops.atomxsupply.com/api/public/openai/products.csv
sudo systemctl enable --now atomx-chatgpt-feed@usuario-ops.timer
```

En el perfil de Atom X Supply en Business Hub, abre **Productos → Añadir productos → Usar una URL alojada** e introduce `https://ops.atomxsupply.com/api/public/openai/products.csv`. Comprueba que se recibe y se procesa la primera importación. Compara una variante del portal con su ficha y comprueba el historial después de la primera actualización programada.

El feed ofrece descubrimiento de productos y remite al usuario a la ficha de la tienda. Los campos de pago y anuncios están desactivados. Puedes completar el perfil con la [web de la tienda](https://www.atomxsupply.com/es/), la [política de envíos](https://www.atomxsupply.com/es/content/1-envio) y la [política de devoluciones](https://www.atomxsupply.com/es/content/6-cancelacion-y-devolucion-de-pedidos).

## Operación

```bash
systemctl list-timers 'atomx-chatgpt-feed*'
journalctl -u atomx-chatgpt-feed@usuario-ops.service -n 30
curl -fsSI https://ops.atomxsupply.com/api/public/openai/products.csv
```

Cada actualización sustituye el archivo completo de forma atómica. Si una lectura falla, la última versión válida sigue disponible hasta las 36 horas desde su generación. Una vez superado ese plazo, la URL devuelve HTTP 503 hasta que se genere un archivo nuevo. Una respuesta 404 indica que la publicación está desactivada. Puedes suspenderla con `CHATGPT_FEED_ENABLED=0`, reiniciando el backend y parando el temporizador con `systemctl disable --now atomx-chatgpt-feed@usuario-ops.timer`.

[Guía de OpenAI para enviar feeds](https://developers.openai.com/commerce/guides/submit-product-feeds) · [Esquema de productos y mercados](https://developers.openai.com/commerce/specs/file-upload/products#geo-tagging) · [Configurar tu empresa en ChatGPT](https://help.openai.com/es-es/articles/20001635-setting-up-your-business-on-chatgpt)
