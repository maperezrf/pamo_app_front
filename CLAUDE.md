# CLAUDE.md — Frontend Pamo

Antes de planear, leer código o editar, leer [`docs/INDEX.md`](docs/INDEX.md)
y la arquitectura, app, patrón y contrato aplicables. Buscar una capacidad
reutilizable documentada antes de crear una nueva.

Consultar código solo después para validar el estado real o resolver un vacío
puntual. Si el código y la documentación difieren, comprobar el comportamiento
y actualizar el documento correspondiente en el mismo cambio cuando aplique.

La memoria privada de Claude, los resúmenes del IDE y el historial de chat no
son fuente de verdad. El conocimiento que otro agente necesite debe quedar en
la documentación versionada de este repositorio.

- React 19 + Vite; axios se usa exclusivamente mediante `src/core/api/httpClient.js`.
- Identidad visual: MUI + tema centralizado en `src/theme/` (ver
  `docs/patterns/THEME.md`). No hex sueltos en componentes; consumir tokens
  del tema.
- El contrato HTTP pertenece al backend; el frontend no inventa endpoints.
- Las variables `VITE_*` son públicas y no contienen secretos.
- Los cambios de API, componente compartido, hook, regla de estado o flujo
  no obvio actualizan documentación relevante antes de cerrar.

Ver `AGENTS.md` para reglas operativas compartidas.
