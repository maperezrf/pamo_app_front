# Arquitectura del frontend

El frontend usa React, React Router y Vite. `App.jsx` carga CSRF, comprueba
la sesión y protege las rutas que se renderizan dentro de `AppShell`.

## Estructura por responsabilidad

```
src/
├── app/
│   ├── layouts/         Marcos visuales generales (AppShell).
│   └── providers/        Providers globales (AppThemeProvider).
├── core/
│   └── api/               Cliente HTTP único y wrapper de endpoints.
├── modules/
│   ├── access/            Pantallas de login y no autorizado.
│   ├── home/               Pantalla principal.
│   └── orders/             Listado y detalle de pedidos.
│       ├── pages/
│       ├── components/     Componentes propios del área.
│       └── orderFormat.js  Etiquetas y formato del área.
├── components/
│   ├── data-display/       StatusChip.
│   ├── navigation/         Sidebar, Topbar.
│   └── tables/              DataTable.
├── theme/                   Paleta, tipografía, forma y sombras (MUI).
└── assets/
```

- `src/app/layouts/`: layouts generales de la aplicación (hoy solo
  `AppShell`). No debe contener reglas de negocio.
- `src/app/providers/`: providers globales de React (hoy solo
  `AppThemeProvider`, ver [`patterns/THEME.md`](../patterns/THEME.md)). No
  crear un provider para estado que solo usa un componente.
- `src/theme/`: identidad visual centralizada consumida por MUI. Los
  componentes no importan sus archivos directamente, solo a través del tema
  distribuido por `AppThemeProvider`.
- `src/core/`: infraestructura técnica transversal (hoy solo `core/api/`,
  con `httpClient.js` y `api.js`). No depende de `modules/` ni de páginas.
- `src/modules/<área>/pages/`: pantallas agrupadas por área funcional.
  Página nueva → primero decidir a qué área pertenece (`access`, `home`, o
  una nueva) antes de agregarla como archivo suelto.
- `src/modules/<área>/components/`: componentes que solo usa esa área (ej.
  filtros o detalle de pedidos). Si otra área los necesita, se mueven a
  `src/components/` y se registran en el catálogo. Etiquetas y formato del
  área viven en un archivo plano del área (ej. `orders/orderFormat.js`).
- `src/components/<categoría>/`: componentes de interfaz reutilizables,
  centralizados y clasificados por función (`navigation`, `tables`, y las
  que se agreguen: `forms`, `filters`, `cards`, `charts`, `modals`,
  `feedback`, `data-display`), nunca por la pantalla que los usa primero.
  Un componente reutilizable vive en su propia carpeta con `index.js` como
  punto de exportación pública; un archivo interno usado por un solo
  componente (ej. `BrandMark` dentro de `Sidebar/`) se anida ahí y no se
  importa desde fuera de esa carpeta. Antes de crear un componente nuevo,
  revisar [`COMPONENT_REGISTRY.md`](COMPONENT_REGISTRY.md) para reutilizar
  o ampliar uno existente en vez de duplicarlo; registrar ahí todo
  componente nuevo o modificado sustancialmente.

No crear una categoría de `components/` ni una subcarpeta de `core/` o
`hooks/` sin un elemento real que la llene. La estructura crece cuando
aparece la necesidad concreta, no antes.

Una pantalla autenticada debe vivir dentro de `AppShell`, usar el menú
entregado por backend y conservar rutas protegidas. No duplicar el estado de
sesión en cada pantalla.
