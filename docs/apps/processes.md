# Área: procesos (orquestador)

Pantalla del orquestador de procesos en segundo plano: historial de
ejecuciones y programaciones. Contrato en
`backend/docs/patterns/orchestrator-usage-guide.md` (sección 5); reglas en
`backend/docs/apps/orchestrator.md`. Rol `Admin` u `Operaciones`.

## Ubicación

| Pieza | Archivo | Responsabilidad |
| --- | --- | --- |
| Página | `src/modules/processes/pages/ProcessesPage.jsx` | Pestaña, filtros y página en la URL; catálogo de procesos. |
| Ejecuciones | `src/modules/processes/components/ExecutionsTab.jsx` | Listado paginado, filtros, recarga automática y cancelar. |
| Detalle | `src/modules/processes/components/ExecutionExpandedDetail.jsx` | Error, paso y progreso, fechas y parámetros de una corrida. |
| Programaciones | `src/modules/processes/components/SchedulesTab.jsx` | Listado, pausar/activar, ejecutar ahora, historial, editar y eliminar. |
| Formulario | `src/modules/processes/components/ScheduleDialog.jsx` | Crear o editar una programación según su frecuencia. |
| Borrado | `src/modules/processes/components/DeleteScheduleDialog.jsx` | Confirmación de borrado. |
| Constantes | `src/modules/processes/processFormat.js` | Estados, frecuencias, días, descripción de una programación. |

Ruta `/processes` (`?tab=schedules` para programaciones). Su entrada de
menú ("Procesos") vive en `backend/accounts/menu_config.py`.

## Comportamiento

- **Ejecuciones** (`GET /api/orchestrator/executions/`): paginado de 20 o
  50, filtros por proceso, estado y programación (`?schedule=<id>`, se
  muestra como chip quitable). El origen es la programación, el correo de
  quien la lanzó o "Automática" (webhooks y lanzamientos internos). Si la
  página tiene ejecuciones activas se recarga sola cada 5 s, sin barra de
  carga; al no quedar activas se detiene.
- **"Log" de una corrida**: el backend no guarda un log de texto (ver
  `backend/docs/apps/orchestrator.md`). El acordeón muestra `error_message`,
  `current_step`, progreso, fechas y `params`.
- **Cancelar**: en ejecuciones pendientes, en cola o ejecutando. Es
  cooperativa: la fila pasa a "Cancelando" y la recarga automática la sigue.
- **Programaciones** (`/api/orchestrator/schedules/`): todas en una tabla
  de cliente. "Cuándo" traduce el tipo a una frase; las CRON de un solo
  horario diario se leen como "Todos los días a las HH:MM". Las horas son
  de Colombia (zona del scheduler).
  - El interruptor "Activa" hace `PATCH {is_active}` (aplica en caliente).
  - "Ejecutar ahora" lanza el proceso con los `params` de la programación
    (`POST /process-types/{code}/launch/`); un `409` avisa que ya corre.
  - "Historial" abre la pestaña de ejecuciones filtrada por esa programación.
  - El formulario envía solo los campos del tipo elegido; la API valida y
    sus errores (`{campo: [mensaje]}`) se muestran tal cual.
- **Errores**: `403` muestra un aviso de permisos; un fallo de red, un aviso
  de conexión.

## Límites

- No hay botón para lanzar un proceso sin programación; se lanza desde su
  pantalla dueña o con "Ejecutar ahora" de una programación.
- Los `params` se editan como JSON libre; ningún proceso programado los usa
  hoy.

## Reutilización

`DataTable` (modo servidor en ejecuciones, cliente en programaciones) y
`StatusChip`.
