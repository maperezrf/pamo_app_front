# Consumo del contrato de backend

El frontend consume rutas del backend mediante `src/core/api/api.js` (sobre `src/core/api/httpClient.js`). La fuente de
verdad del contrato publicado vive en `backend/docs/contracts/API.md`; antes
de modificar una llamada, confirmar el contrato allí y coordinar ambos
repositorios si cambia.

Las rutas de acceso actuales son CSRF, Google login, identidad de sesión,
logout, menú y verificación administrativa. Pedidos: `api.listOrders(params)`
→ `GET /api/orders/` (ver [`../apps/orders.md`](../apps/orders.md)).

No introducir un endpoint por inferencia. Todo cambio de método, ruta,
permisos, body, respuesta o error se actualiza en backend y frontend dentro
del trabajo coordinado.
