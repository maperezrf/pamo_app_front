# Índice técnico del frontend

Este documento es el punto de entrada para entender y modificar el frontend
React de Pamo. El backend es un repositorio separado y publica los contratos
HTTP que este cliente consume.

## Lectura obligatoria antes de cambiar código

1. Leer este índice.
2. Leer arquitectura, pantalla, patrón y contrato aplicables.
3. Buscar primero capacidades reutilizables documentadas.
4. Inspeccionar código solo para validar una afirmación, localizar una
   implementación o resolver un vacío puntual.

Si la documentación difiere del código, verificar el comportamiento real y
actualizar el documento pertinente en el mismo cambio cuando corresponda.

## Memoria compartida

El conocimiento durable vive en este repositorio, en particular en `docs/`.
La memoria privada de una herramienta, historial de chat o archivos de IDE no
son requisito para comprender el proyecto. Un hallazgo útil se verifica y, si
aplica, se incorpora a la documentación versionada.

## Mapa actual

| Área | Ubicación | Responsabilidad | Documento |
| --- | --- | --- | --- |
| Inicio y rutas | `src/App.jsx` | Sesión, rutas protegidas y carga de menú. | [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md) |
| API HTTP | `src/core/api/httpClient.js`, `src/core/api/api.js` | Axios, CSRF y wrapper de endpoints. | [`patterns/HTTP_CLIENT.md`](patterns/HTTP_CLIENT.md) |
| Acceso | `src/modules/access/pages/LoginPage.jsx` | Inicio de sesión con Google. | [`apps/access.md`](apps/access.md) |
| Shell compartido | `src/app/layouts/AppShell/`, `src/components/navigation/` | Sidebar, topbar, footer y layout autenticado. | [`architecture/OVERVIEW.md`](architecture/OVERVIEW.md) |
| Tabla compartida | `src/components/tables/DataTable/` | Tabla con filtro, orden y paginación. | [`patterns/DATA_TABLE.md`](patterns/DATA_TABLE.md) |
| Tema | `src/theme/`, `src/app/providers/AppThemeProvider.jsx` | Paleta, tipografía, forma y sombras (MUI). | [`patterns/THEME.md`](patterns/THEME.md) |

## Documentos disponibles

| Tema | Cuándo leerlo |
| --- | --- |
| [Arquitectura](architecture/OVERVIEW.md) | Rutas, pantallas, layout o una nueva área. |
| [Catálogo de componentes](architecture/COMPONENT_REGISTRY.md) | Antes de crear cualquier componente en `src/components/`. |
| [Cliente HTTP](patterns/HTTP_CLIENT.md) | Cualquier llamada al backend. |
| [Autenticación y sesión](patterns/AUTHENTICATION.md) | Login, logout, rutas protegidas o CSRF. |
| [Tabla reutilizable](patterns/DATA_TABLE.md) | Listados tabulares. |
| [Tema centralizado (MUI)](patterns/THEME.md) | Colores, tipografía, forma o cualquier componente nuevo con MUI. |
| [Orquestador (procesos asíncronos)](patterns/ORCHESTRATOR_POLLING.md) | Lanzar y hacer polling de un proceso de larga duración. |
| [Consumo de API](contracts/API_CONSUMPTION.md) | Cambio de contrato con backend. |
| [App de acceso](apps/access.md) | Pantallas y flujos de autenticación. |

## Regla de mantenimiento

Documentar en el mismo cambio una capacidad reutilizable, un hook, cliente,
componente compartido, contrato, regla de estado o comportamiento no obvio.
Un ajuste local y evidente no requiere un archivo nuevo. Nunca documentar
valores de variables `VITE_*` que puedan ser sensibles; esas variables son
públicas en el bundle.

## Roles de trabajo

- [Arquitecto](roles/ARCHITECT.md): convierte el requerimiento en un plan
  contextualizado, sin implementar código.
- [Desarrollador](roles/DEVELOPER.md): valida y ejecuta el plan, prueba y
  mantiene la documentación relevante.
