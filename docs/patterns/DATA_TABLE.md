# Patrón: `DataTable`

Ubicación: `src/components/tables/DataTable/`. Importar desde
`src/components/tables/DataTable` (su `index.js` público), nunca desde el
archivo interno.

`DataTable` usa TanStack Table para filtro global, orden y paginación local.
Recibe `columns`, `data` y opcionalmente `emptyMessage`.

Usarla cuando toda la colección ya está disponible en la pantalla y el
filtro/orden local es suficiente. No usarla como sustituto de paginación del
servidor para colecciones grandes: ese caso requiere un contrato de API y un
estado de carga explícitos.

Las columnas siguen el contrato de TanStack Table. El componente ya informa
cuando no hay filas y deshabilita navegación de página cuando no corresponde.
