# Área: facturación

Pantalla de consulta de las facturas en Siigo de los pedidos de marketplace
(hoy solo Sodimac), sobre `GET /api/invoicing/` (contrato en
`backend/docs/contracts/API.md`; reglas en `backend/docs/apps/invoicing.md`).
Es de solo lectura: el backend lee su base de datos, nunca Siigo en vivo.

## Ubicación

| Pieza | Archivo | Responsabilidad |
| --- | --- | --- |
| Página | `src/modules/invoicing/pages/InvoicesPage.jsx` | Estado en la URL, carga, columnas, enlaces y errores. |
| Filtros | `src/modules/invoicing/components/InvoiceFilters.jsx` | Búsqueda (con espera de 400 ms), estado, canal y rango de fechas. |
| Detalle | `src/modules/invoicing/components/InvoiceExpandedDetail.jsx` | Contenido del acordeón: motivo del fallo, datos, SKU e impuestos. |
| Etiquetas | `src/modules/invoicing/invoiceFormat.js` | Estados, canales del filtro y la explicación de los rechazos conocidos de Siigo. |

Ruta `/invoicing`. Su entrada de menú ("Facturación") vive en
`backend/accounts/menu_config.py`, con los mismos roles del endpoint
(`Admin` y `Operaciones`).

## Comportamiento

- **La URL es la fuente de verdad** de `status`, `marketplace`,
  `date_from`, `date_to`, `search`, `page` y `page_size`. Cambiar un filtro
  vuelve a la página 1. Los valores vacíos no se envían. La paginación es
  de servidor: `DataTable` en modo servidor, con 20 o 50 filas por página.
- **Columnas**: fecha de la factura, canal, pedido del marketplace (OC),
  pedido de Shopify, número de factura, estado y total.
- **Enlaces** (se abren en una pestaña nueva y no despliegan la fila):
  - el pedido de Shopify abre `<admin>/orders/<shopify_order_id>`
    (`shopifyOrderUrl`; sin `VITE_SHOPIFY_ADMIN_URL`, se muestra solo el
    texto);
  - el número de factura abre `siigo_url`, la vista pública de la factura
    en Siigo (`documentview.siigo.com`); una factura que no se creó no
    tiene número ni link;
  - en el acordeón, cada SKU abre la búsqueda de productos del admin de
    Shopify.

  La OC es texto plano, porque el portal del marketplace no tiene una URL
  por pedido.
- **Estados** (`invoiceFormat.js`):
  - `creada`: "Creada".
  - `error`: "Error". Siigo la rechazó y la siguiente corrida la reintenta.
  - `creando`: "Sin confirmar". El proceso se cortó y no se sabe si la
    factura existe; hay que revisarla en Siigo, porque no se reintenta
    sola.

  El chip muestra `error_message` al pasar el mouse.
- **Acordeón**: si la factura no se creó, muestra una alerta con la
  explicación del estado, el mensaje de Siigo tal cual y, para los rechazos
  conocidos, qué hacer (`invoiceErrorHint`):
  - SKU que no existe en Siigo: crearlo en Siigo o corregir la
    equivalencia;
  - diferencia de total: se reintenta sola.

  También muestra el cliente, si la factura se timbró, el id en Siigo, el
  último intento, los SKU (cantidad, precio sin IVA y total) y el desglose:
  subtotal, IVA, retenciones, total del pago y total en Siigo.
- **Errores**: `400` muestra el mensaje de validación del backend; `403`,
  un aviso de permisos; un `404` de página inexistente vuelve a la página
  1; un fallo de red muestra un aviso de conexión. Una respuesta vieja se
  descarta si los filtros cambiaron antes de que llegara.

## Reutilización

`DataTable`, `StatusChip` y `MarketplaceLabel` (`src/components/`), más el
formato común de `src/core/format/` (`formatDate`, `formatDateTime`,
`formatMoney`, `shopifyOrderUrl`, `shopifyProductSearchUrl`), que comparte
con el área de pedidos.
