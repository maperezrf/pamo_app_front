# Área: pedidos

Pantalla de consulta de pedidos sobre `GET /api/orders/` (contrato en
`backend/docs/contracts/API.md`, `OrderListAPI`). Solo lectura: el backend
lee su copia local de Shopify, nunca Shopify en vivo.

## Ubicación

| Pieza | Archivo | Responsabilidad |
| --- | --- | --- |
| Página | `src/modules/orders/pages/OrdersPage.jsx` | Estado en la URL, carga, pestañas, columnas y errores. |
| Filtros | `src/modules/orders/components/OrderFilters.jsx` | Búsqueda (con espera de 400 ms), canal y rango de fechas. |
| Detalle | `src/modules/orders/components/OrderExpandedDetail.jsx` | Contenido del acordeón: contacto, bodega, error y productos. |
| Canal | `src/modules/orders/components/MarketplaceLabel.jsx` | Logo + nombre del canal (tabla, detalle y filtro). |
| Formato | `src/modules/orders/orderFormat.js` | Etiquetas y logos de canal, estados, fechas y dinero. |

Ruta `/orders` (rutas y valores de la URL en inglés; los textos visibles en español). Su entrada de menú vive en `backend/accounts/menu_config.py`
con los mismos roles del endpoint (`Admin`, `Operaciones`).

## Comportamiento

- **La URL es la fuente de verdad** de `marketplace`, `date_from`,
  `date_to`, `search`, `page`, `page_size` y `tab`. Cambiar un filtro vuelve
  a la página 1. Los valores vacíos no se envían: el backend rechaza
  `marketplace=""` con `400`.
- **Pestaña "En Shopify"**: `orders`, paginado en servidor con `DataTable`
  en modo servidor (20 o 50 por página; el backend permite hasta 50).
- **Pestaña "No creados"**: `orders_not_created`. Llega completa en cada
  respuesta (hasta 200), por eso usa `DataTable` en modo cliente. Si
  `orders_not_created_count` supera lo recibido, se avisa que se muestran
  solo los más recientes.
- **Errores**: `400` muestra el mensaje de validación del backend; `403`,
  un aviso de permisos; `404` de página inexistente vuelve a la página 1;
  un fallo de red muestra un aviso de conexión. Una respuesta vieja se
  descarta si los filtros cambiaron antes de que llegara.
- **Acordeón**: un clic en la fila (o en la flecha) despliega debajo los
  productos del pedido con el contacto del cliente y la novedad de bodega;
  en un pedido no creado, también el error.
- **Enlaces a Shopify** (pestaña nueva): el número de pedido abre
  `<admin>/orders/<shopify_order_id>`; el SKU de cada producto abre la
  búsqueda de productos del admin por ese SKU, porque el contrato no trae el
  id del producto. El SKU de un pedido no creado es del marketplace y no
  enlaza. `<admin>` es `VITE_SHOPIFY_ADMIN_URL`
  (`https://admin.shopify.com/store/<tienda>`, no es secreta); sin ella, se
  muestran los textos sin enlace.
- **Despacho a bodega** (`dispatch` del contrato): en el acordeón de un
  pedido de Shopify se muestra la bodega que despacha, el estado del
  despacho (con su motivo en `note`), la guía y cada aviso por canal
  (API de Envía, correo, WhatsApp) con su estado, destinatario o error.
  Pedidos sin despacho (`dispatch: null`) no muestran el bloque. Etiquetas
  en `orderFormat.js` (`dispatchStatus`, `notificationStatus`,
  `notificationChannelLabel`).
- **Columna "Aviso"**: estado del despacho (`dispatchStatus`), con la
  bodega y los canales avisados en el `title`.
- **Botones del despacho** (`components/DispatchActions.jsx`, en el
  acordeón de pedidos de Shopify): "Traer guía" (Mercado Libre, Falabella),
  "Generar guía" (tienda web: diálogo que cotiza, muestra opciones con
  precio y genera la elegida; deshabilitado si ya tiene guía generada) y
  "Notificar a proveedor". Piden confirmación, muestran el `detail` del
  backend si falla y recargan el listado al terminar.
- `last_synced_at` se muestra como la fecha de la última sincronización
  con Shopify.

## Etiquetas

`orderFormat.js` traduce los valores del contrato: canales (`Marketplace`
del backend más `shopify`), `financial_status` y `fulfillment_status` de
Shopify, la bodega (`fulfillment.status`: `asignada`, `novedad`,
`resuelta_manual`, vacío = sin evaluar) y el `status` de los no creados. Un
valor desconocido se muestra tal cual. Si el backend agrega un canal o un
estado, se agrega acá.

Logos de canal: íconos oficiales de cada sitio en
`src/assets/marketplaces/<valor>.png` (el valor del contrato: `falabella`,
`mercadolibre`, `madecentro`, `sodimac`, `shopify`). Sodimac usa el ícono
de Homecenter, la marca con la que opera en Colombia. Se empaquetan con la
app (no se cargan de sitios externos). Un canal nuevo agrega su PNG ahí y
su entrada en `MARKETPLACE_LOGOS`; sin logo, se muestra solo el nombre.

Fechas en hora de Colombia; importes con `Intl.NumberFormat` `es-CO` en la
moneda del pedido (`COP` cuando no viene).
