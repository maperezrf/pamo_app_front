# CLAUDE.md — Frontend (pamo_app_front)

Guía para Claude Code (o cualquier agente/IDE) al trabajar en este
repositorio: **React 19 + Vite** para **Pamo**. Este repo es independiente
de `Pamo_app_back` (backend Django) y del repo del servidor MCP
`governance-pamo` — cada uno tiene su propio ciclo de vida y su propio
`CLAUDE.md`.

## Consulta obligatoria de lineamientos (MCP `governance-pamo`)

Antes de escribir o modificar código en este repo, consultar el servidor
MCP `governance-pamo` en este orden:

1. `obtener_mapa_documentacion` — índice de toda la documentación.
2. `obtener_lineamientos_generales` — siempre.
3. `obtener_lineamientos_frontend` — arquitectura React/Vite: pantallas por
   área, cliente HTTP, estado, variables de entorno, contrato con el
   backend, lint, checklist.
4. `obtener_lineamientos_git` — al ramear, commitear o abrir un PR.

Si la tarea no está cubierta por ninguno de estos documentos, seguir el
conocimiento general del modelo y las convenciones ya presentes en el
código — no bloquear el trabajo por falta de lineamiento explícito.

`docs/GOVERNANCE.md` en este repo es solo un puntero corto a lo de arriba,
no un documento a mantener en paralelo.

## Stack

- React 19 + Vite.
- `@react-oauth/google` para login.
- Cliente HTTP: **axios**, instancia única en `src/lib/httpClient.js`
  (`baseURL` desde `VITE_API_BASE_URL`, `withCredentials: true`,
  interceptor que agrega `X-CSRFToken`). `src/api.js` es un wrapper delgado
  sobre esa instancia con una función por endpoint.
- Lint: `oxlint` (`npm run lint`).

## Estructura actual

```
src/
  api.js              wrapper delgado sobre lib/httpClient.js, funciones por endpoint
  lib/httpClient.js    instancia única de axios
  screens/             Login, Dashboard, Unauthorized
  shared/layout/        AppShell, Sidebar, Topbar, Footer, BrandMark
```

Todavía no existe la carpeta `areas/<área>/` que describen los
lineamientos del MCP — solo está construida el área Accesos y Seguridad,
implementada directo en `screens/`. Al agregar una segunda área de
negocio, adoptar recién ahí la estructura por área (`areas/<área>/screens`,
`areas/<área>/api.js`) en vez de seguir creciendo `screens/` como carpeta
plana.

## Flujo de desarrollo

```bash
cp .env.example .env           # completar VITE_GOOGLE_CLIENT_ID
npm install
npm run dev                    # http://localhost:5173
npm run lint                   # oxlint
```

## Variables de entorno

`.env` (ver `.env.example`): `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`.
Todo lo que está en una variable `VITE_*` es público — nunca un secreto
real ahí (ver `obtener_lineamientos_frontend` del MCP).
