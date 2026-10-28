# Patrón: cliente HTTP

Ubicación: `src/core/api/httpClient.js` y `src/core/api/api.js`.

Todas las solicitudes al backend usan la única instancia `httpClient`. Esta
configura `baseURL` desde `VITE_API_BASE_URL`, incluye cookies y obtiene un
token CSRF antes de solicitudes que no son `GET`.

El token se guarda en memoria y se descarta después de iniciar o cerrar
sesión (`ROTATES_CSRF`): Django lo rota en el login, y con el anterior cada
`POST` respondía `403`, que las pantallas muestran como "No tienes permiso…"
aunque el usuario tenga el rol (pasó en 2026-10 al cargar SKU sin recargar
la página después del login). Como red de seguridad, un `403` cuyo `detail`
empieza por `CSRF Failed` renueva el token y repite la solicitud una vez.

No crear otra instancia de Axios ni llamar `fetch` directamente para un
endpoint del backend. Añadir una función delgada a `api` que devuelva el
formato común `{ ok, status, data }`. `request(path, { method, body,
params })`: `params` es la query string (Axios omite los `undefined`, pero
envía los strings vacíos, así que la pantalla no debe pasar filtros vacíos).

El wrapper transforma respuestas HTTP rechazadas en `ok: false`; errores sin
respuesta HTTP se propagan para que la pantalla pueda tratarlos como fallo de
red. Si cambia una ruta, método o respuesta, actualizar también
[`../contracts/API_CONSUMPTION.md`](../contracts/API_CONSUMPTION.md).
