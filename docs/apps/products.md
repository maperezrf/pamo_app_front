# Área: productos

Pantalla del catálogo: productos, equivalencias de SKU por marketplace y
kits. Contrato en `backend/docs/contracts/API.md`; reglas en
`backend/docs/apps/products.md`. Rol `Admin` en todas las rutas.

## Ubicación

| Pieza | Archivo | Responsabilidad |
| --- | --- | --- |
| Página | `src/modules/products/pages/ProductsPage.jsx` | Búsqueda y página en la URL, listado, acordeón y apertura de diálogos. |
| Detalle | `src/modules/products/components/ProductExpandedDetail.jsx` | Equivalencias (canal, SKU, EAN) y componentes del kit, con sus acciones. |
| Carga de SKU | `src/modules/products/components/SkuUploadDialog.jsx` | Excel o una fila de UN marketplace, polling y reporte. |
| Kits | `src/modules/products/components/KitDialog.jsx` | Un kit en formulario o varios desde Excel. |
| Archivo | `src/modules/products/components/ExcelFileField.jsx` | Elegir `.xlsx`, `.xls` o `.csv`. |
| Borrado | `src/modules/products/components/DeleteDialog.jsx` | Confirmación y borrado de una equivalencia o un kit. |
| Constantes | `src/modules/products/productFormat.js` | Canales, columnas, tope de filas, estados de la carga. |

Ruta `/products`. Su entrada de menú ("Productos") vive en
`backend/accounts/menu_config.py` con el rol del endpoint (`Admin`).

## Comportamiento

- **Listado** (`GET /api/products/`): la URL guarda `search` y `page`. La
  búsqueda espera 400 ms. El backend pagina de a 100 y no acepta
  `page_size`. Las columnas son SKU Pamo, nombre, tipo, los SKU de Sodimac
  y Madecentro.
- **Carga de SKU** (`POST /api/products/sku-uploads/`):
  - Botón "Cargar SKU": se elige el marketplace y se sube un Excel
    (`sku_pamo`, `sku_marketplace`, `ean` opcional; hay plantilla) o se
    llena una sola fila.
  - Una equivalencia nueva se agrega con "Cargar SKU" (modo "Una fila"; no
    hay botón por producto). En el acordeón, "Editar" precarga la fila con
    el canal y el SKU del marketplace fijos.
    Cambiar el SKU de Pamo **reasigna** la equivalencia.
  - Es la misma carga en segundo plano: polling del detalle cada 2,5 s
    hasta un estado final (ver
    [`../patterns/ORCHESTRATOR_POLLING.md`](../patterns/ORCHESTRATOR_POLLING.md)).
    Al terminar se muestra el resumen (o el resultado de la fila única), se
    ofrece "Descargar reporte" (filas con `resultado`) y se recarga el
    listado.
  - Un EAN vacío no borra el existente. Los kits no se aceptan en esta
    carga.
- **Kits** (`POST /api/products/kits/`): "Cargar kits" abre el formulario
  de un kit o la carga desde Excel (`kit_sku`, `component_sku`,
  `quantity`; "Descargar kits actuales" da el archivo para editarlo).
  "Editar kit" en el acordeón abre el formulario con sus componentes. Cada
  kit enviado **reemplaza completo** sus componentes. Los errores se
  muestran por fila (en Excel, con el número de fila del archivo).
- **Eliminar** (con confirmación, no se puede deshacer):
  - "Eliminar" en una equivalencia (`DELETE /api/products/marketplace-skus/<id>/`)
    borra solo ese SKU; el producto queda.
  - "Eliminar kit" (`DELETE /api/products/kits/<id>/`) borra el kit con sus
    componentes y todas sus equivalencias; los productos componentes quedan.
  - Un `404` se trata como borrado (otra persona ya lo eliminó).
- **Errores**: `403` muestra un aviso de permisos; un `400` muestra el
  mensaje del backend (columnas desconocidas en kits); un fallo de red
  muestra un aviso de conexión.

## Límites

- **Solo Sodimac y Madecentro**: la carga, las columnas y el acordeón
  muestran esos dos canales (`SKU_UPLOAD_MARKETPLACES`), aunque el backend
  acepta los cuatro. Las equivalencias de otros canales no se ven aquí.
- No se borran productos simples, solo equivalencias y kits.
- El SKU de marketplace de un kit (ej. Madecentro) no se asigna desde esta
  pantalla: la carga de SKU rechaza kits.
- No hay historial de cargas en pantalla, aunque el backend lo expone
  (`GET /api/products/sku-uploads/`). El reporte se descarga al terminar.

## Reutilización

`DataTable`, `StatusChip` y `MarketplaceLabel` (`src/components/`), más
`src/core/excel/` (`readSheetRows`, `downloadSheet`).
