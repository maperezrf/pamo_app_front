# Catálogo de componentes

Registro de los componentes reutilizables de `src/components/`. Antes de
crear un componente nuevo, revisar este catálogo: reutilizar o ampliar uno
existente si cubre la necesidad; crear uno nuevo solo si no hay una
alternativa razonable. El objetivo es no duplicar el mismo wrapper con otro
nombre.

Un componente usado solo por otro componente (no importado desde ningún otro
lugar) no se registra acá — vive dentro de la carpeta de su consumidor como
detalle interno (ver `BrandMark`, privado de `Sidebar/`).

## Índice

| Componente | Categoría | Ruta | Usado por |
| --- | --- | --- | --- |
| `Sidebar` | navigation | `src/components/navigation/Sidebar/` | `AppShell` |
| `Topbar` | navigation | `src/components/navigation/Topbar/` | `AppShell` |
| `DataTable` | tables | `src/components/tables/DataTable/` | `OrdersPage` |
| `StatusChip` | data-display | `src/components/data-display/StatusChip/` | `OrdersPage`, `OrderDetailDrawer` |

## `Sidebar`

- **Responsabilidad**: menú de navegación principal del shell autenticado.
  En escritorio es un `Drawer` `permanent` colapsable (240px ↔ 72px,
  preferencia persistida en `localStorage`); en móvil (`< 768px`) es un
  `Drawer` `temporary` con su propio backdrop. Al colapsar en escritorio,
  los ítems de navegación se ocultan por completo, no solo el texto.
- **Props**: `items` (árbol `{key, label, path, submodulos}` que entrega el
  backend, ver [`AUTHENTICATION.md`](../patterns/AUTHENTICATION.md)),
  `mobileOpen` (bool), `onCloseMobile` (fn).
- **No usar para**: menús secundarios o contextuales — asume que es *el*
  menú principal de la app; hoy tiene un solo consumidor (`AppShell`).
- **Dependencias**: MUI `Drawer`/`List`/`ListItemButton`; `react-router-dom`
  (`Link`, `useLocation`).

## `Topbar`

- **Responsabilidad**: barra superior del shell autenticado — botón de menú
  en móvil, email del usuario, acción de cerrar sesión.
- **Props**: `user` (`{ email }`), `onLogout` (fn), `onToggleMobileNav` (fn).
- **Dependencias**: MUI `AppBar`/`Toolbar`.

## `DataTable`

- **Responsabilidad**: tabla genérica (TanStack Table por debajo, markup
  de MUI). Modo cliente: filtro global, orden y paginación locales. Modo
  servidor (`pagination`): muestra la página que entrega el backend. Ver
  [`patterns/DATA_TABLE.md`](../patterns/DATA_TABLE.md).
- **Props**: `columns` (TanStack Table; `meta.align` alinea la columna),
  `data`, `emptyMessage`, `loading`, `onRowClick`, `getRowId`, y
  `pagination` (`page`, `pageSize`, `count`, `onPageChange`,
  `pageSizeOptions`, `onPageSizeChange`) para el modo servidor.
- **No usar para**: ordenar o filtrar en el navegador una colección paginada
  por el backend; en modo servidor esos filtros van en la consulta.
- **Dependencias**: `@tanstack/react-table`; MUI `Table`, `TableSortLabel`,
  `TextField`, `Paper`.

## `StatusChip`

- **Responsabilidad**: etiqueta corta de estado con un tono del tema
  (`success`, `error`, `neutral`).
- **Props**: `label`, `tone` (por defecto `neutral`), `title` (opcional,
  texto al pasar el mouse).
- **No usar para**: acciones o filtros clicables; para eso usar `Chip` o
  `Button` de MUI. Un tono nuevo se agrega solo si la paleta ya tiene el
  color.
- **Dependencias**: MUI `Chip`.

## Mantenimiento

Actualizar este archivo en el mismo cambio que crea o modifica
sustancialmente un componente de `src/components/`. Si un componente queda
obsoleto, marcarlo acá (con el reemplazo recomendado) antes de eliminarlo
del código.
