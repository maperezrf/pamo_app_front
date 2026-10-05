# Patrón: cliente HTTP

Ubicación: `src/core/api/httpClient.js` y `src/core/api/api.js`.

Todas las solicitudes al backend usan la única instancia `httpClient`. Esta
configura `baseURL` desde `VITE_API_BASE_URL`, incluye cookies y obtiene un
token CSRF antes de solicitudes que no son `GET`.

No crear otra instancia de Axios ni llamar `fetch` directamente para un
endpoint del backend. Añadir una función delgada a `api` que devuelva el
formato común `{ ok, status, data }`.

El wrapper transforma respuestas HTTP rechazadas en `ok: false`; errores sin
respuesta HTTP se propagan para que la pantalla pueda tratarlos como fallo de
red. Si cambia una ruta, método o respuesta, actualizar también
[`../contracts/API_CONSUMPTION.md`](../contracts/API_CONSUMPTION.md).
