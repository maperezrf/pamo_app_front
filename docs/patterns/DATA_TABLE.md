# Patrón: `DataTable`

Ubicación: `src/components/tables/DataTable/`. Importar desde
`src/components/tables/DataTable` (su `index.js` público), nunca desde el
archivo interno.

`DataTable` muestra filas con markup de MUI sobre TanStack Table. Tiene dos
modos.

## Modo cliente (por defecto)

Recibe toda la colección en `data` y hace filtro global, orden y paginación
local (10 por página). Usarlo cuando la colección completa ya está en la
pantalla. Ejemplo: pedidos no creados en `OrdersPage`.

## Modo servidor (`pagination`)

Se activa al pasar `pagination`. `data` es solo la página actual; la
pantalla es dueña de la página, el tamaño y los filtros, y los pide al
backend. En este modo la tabla no muestra el buscador ni permite ordenar
columnas, porque eso le corresponde a la consulta del backend.

```jsx
<DataTable
  columns={columns}
  data={pageRows}
  loading={loading}
  pagination={{
    page,              // empieza en 1
    pageSize,
    count,             // total del backend
    onPageChange,      // (nuevaPagina) => void
    pageSizeOptions,   // opcional, ej. [20, 50]
    onPageSizeChange,  // opcional, (tamaño) => void
  }}
/>
```

Usarlo para colecciones paginadas por el backend (`count`/`page` de DRF).
Ejemplo: `OrdersPage`.

## Props comunes

- `columns`: definición de columnas de TanStack Table. `meta.align`
  (`"right"`, `"center"`) alinea encabezado y celdas.
- `emptyMessage`: texto sin filas.
- `loading`: muestra una barra de progreso y atenúa las filas actuales
  (no las borra, para que la tabla no salte entre páginas).
- `onRowClick(row.original)`: hace clicable la fila, por ejemplo para abrir
  un detalle.
- `getRowId`: id estable de la fila (recomendado cuando los datos vienen
  del backend).
