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
| `DataTable` | tables | `src/components/tables/DataTable/` | `PrototiposPage` |

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

- **Responsabilidad**: tabla genérica con filtro global, orden y paginación,
  todo en cliente (TanStack Table por debajo, markup de MUI). Ver también
  [`patterns/DATA_TABLE.md`](../patterns/DATA_TABLE.md).
- **Props**: `columns` (definición de columnas de TanStack Table), `data`,
  `emptyMessage` (opcional).
- **No usar para**: colecciones grandes que necesiten paginación de
  servidor — ese caso requiere un contrato de API y estado de carga propios.
- **Dependencias**: `@tanstack/react-table`; MUI `Table`, `TableSortLabel`,
  `TextField`, `Paper`.

## Mantenimiento

Actualizar este archivo en el mismo cambio que crea o modifica
sustancialmente un componente de `src/components/`. Si un componente queda
obsoleto, marcarlo acá (con el reemplazo recomendado) antes de eliminarlo
del código.
