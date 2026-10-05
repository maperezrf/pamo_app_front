# Patrón: consumo del orquestador (procesos asíncronos)

Fuente de verdad del contrato: `backend/docs/patterns/orchestrator-usage-guide.md`.
Este documento traduce ese contrato a cómo debe consumirse desde React; si el
backend cambia una ruta, estado o permiso, actualizar ambos documentos.

Ningún módulo del frontend consume todavía el orquestador. Este patrón aplica
cuando una pantalla lance un proceso de larga duración (por ejemplo, un
reporte o una importación) y necesite mostrar su progreso.

## Flujo

1. Lanzar el proceso. Preferir el endpoint dedicado de la app dueña si existe
   (ej. `GET /api/orders/falabella/importar/`); si no, usar el genérico:
   ```
   POST /api/orchestrator/process-types/{code}/launch/
   Body opcional: { "params": {...} }
   → 202 { execution_id, status }
   ```
2. Guardar `execution_id` y hacer polling:
   ```
   GET /api/orchestrator/executions/{execution_id}/
   ```
   cada 2-3 segundos mientras `status` no sea uno de los estados finales.
   Detener el intervalo en cuanto llegue un estado final; no dejarlo corriendo
   en segundo plano.
3. Cancelar (opcional, solo si el proceso lo permite):
   ```
   POST /api/orchestrator/executions/{execution_id}/cancel/
   ```
   No garantiza cancelación inmediata; seguir el polling hasta ver
   `CANCELADO`. Deshabilitar la acción de cancelar mientras el estado ya sea
   `CANCELANDO` o final.

## Estados (`status`)

`PENDIENTE`, `EN_COLA`, `EJECUTANDO`, `CANCELANDO` requieren seguir el
polling. `COMPLETADO`, `ERROR`, `CANCELADO`, `INTERRUMPIDO` son finales.
Usar `progress_percent` y `current_step` para la barra de progreso mientras
está `EJECUTANDO`; usar `error_message` cuando el estado sea `ERROR`.

## Errores a manejar

- `403`: el usuario no tiene rol `Admin` u `Operaciones` (o el rol específico
  del endpoint dedicado, si aplica). Ocultar la acción o mostrar acceso
  denegado, no reintentar.
- `404` en el polling: el `execution_id` no existe. Cortar el intervalo y
  mostrar error genérico.
- `409` al lanzar: ya hay una ejecución activa para ese proceso
  (`allow_concurrent=False`). Consultar
  `GET /api/orchestrator/executions/?process_type={code}&status=EJECUTANDO`
  (y `EN_COLA`) para encontrar el `execution_id` activo y engancharse a su
  polling en vez de solo mostrar el error.

## Catálogo y listado (opcional)

`GET /api/orchestrator/process-types/` lista los procesos activos, útil solo
si una pantalla necesita construir un menú dinámico de procesos disponibles.
`GET /api/orchestrator/executions/` acepta `?status=` y `?process_type=`
(combinables) para historial o para el caso del `409` anterior.

## Autenticación y permisos

Sesión de Django por cookie, igual que el resto del contrato (ver
[`AUTHENTICATION.md`](AUTHENTICATION.md)). No hay JWT ni Keycloak. Todos los
endpoints del orquestador exigen sesión autenticada y rol `Admin` u
`Operaciones`; un endpoint dedicado de una app dueña puede exigir un rol más
específico.

## No hacer

- No reimplementar el polling con `fetch` directo: usar `httpClient`/`api.js`
  como el resto de llamadas (ver [`HTTP_CLIENT.md`](HTTP_CLIENT.md)).
- No dejar un `setInterval` de polling activo tras desmontar el componente o
  tras llegar a un estado final.
- No asumir que `cancel` termina el proceso de inmediato.
- No duplicar el catálogo de procesos ni sus roles a mano en el frontend: son
  datos, se consultan.
