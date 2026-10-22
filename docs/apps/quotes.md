# Área: cotizaciones

Pantalla de las cotizaciones (draft orders de Shopify) con su PDF, migrada
de `pamo_web` (`/quoteprint/`). Consume `GET /api/quotes/` y
`GET /api/quotes/<id>/pdf/` (contrato en `backend/docs/contracts/API.md`;
reglas en `backend/docs/apps/quotes.md`). El backend lee Shopify en vivo:
no hay copia local ni botón "Actualizar".

## Ubicación

| Pieza | Archivo | Responsabilidad |
| --- | --- | --- |
| Página | `src/modules/quotes/pages/QuotesPage.jsx` | Búsqueda en la URL, carga, columnas, descarga y copia del link. |

Ruta `/quotes`. Su entrada de menú ("Cotizaciones") vive en
`backend/accounts/menu_config.py`, con los roles del endpoint (`Admin` y
`Operaciones`).

## Comportamiento

- Sin búsqueda muestra las 250 cotizaciones más recientes. `search` (en la
  URL, con espera de 400 ms) se manda al backend, que busca en Shopify, así
  que encuentra también las más viejas. La tabla es `DataTable` en modo
  cliente con `searchable={false}`: no hay un segundo buscador local.
- **Columnas**: número (abre `<admin>/draft_orders/<id>` con
  `shopifyDraftOrderUrl`), fecha, cliente, valor, vendedor (primera
  etiqueta de Shopify), NIT y acciones.
- **Descargar PDF**: `api.downloadQuotePdf(id)` (con sesión). Un `404` avisa
  que la cotización ya no existe en Shopify.
- **Copiar link para el cliente**: copia `pdf_link`, el link público firmado
  que se manda al cliente (sin usuario; vence a los 90 días). Deshabilitado
  si viene vacío (el backend no tiene `BACKEND_PUBLIC_URL`).
- **Errores**: `403` muestra un aviso de permisos; otro fallo, que no se pudo
  leer Shopify.

## Reutilización

`DataTable` y el formato común de `src/core/format/` (`formatDate`,
`formatMoney`, `shopifyDraftOrderUrl`).
