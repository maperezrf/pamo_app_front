import { Alert, Box, LinearProgress, Typography } from "@mui/material";
import { formatDateTime } from "../../../core/format";
import { executionStatus } from "../processFormat";

// Contenido desplegado de una ejecución (acordeón de DataTable): el "log" de
// la corrida. El backend no guarda un log de texto: se muestra el paso
// actual, el progreso, el error y los parámetros con que corrió.
export default function ExecutionExpandedDetail({ execution }) {
  const status = executionStatus(execution.status);
  const hasParams = execution.params && Object.keys(execution.params).length > 0;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pl: { md: 5 } }}>
      {execution.error_message && (
        <Alert severity="error" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace" }}>
          {execution.error_message}
        </Alert>
      )}
      {execution.status === "INTERRUMPIDO" && (
        <Alert severity="warning">El servidor se reinició mientras esta ejecución estaba activa.</Alert>
      )}

      {status.active && (
        <Box sx={{ maxWidth: 420 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            {execution.current_step || "Esperando"} · {execution.progress_percent}%
          </Typography>
          <LinearProgress variant="determinate" value={execution.progress_percent} />
        </Box>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 1 }}>
        <Info label="Creada" value={formatDateTime(execution.created_at)} />
        <Info label="Inicio" value={formatDateTime(execution.started_at)} />
        <Info label="Fin" value={formatDateTime(execution.finished_at)} />
        {!status.active && <Info label="Último paso" value={execution.current_step} />}
        {execution.cancellation_requested && <Info label="Cancelación" value="Solicitada" />}
      </Box>

      {hasParams && (
        <Box>
          <Typography variant="caption" color="textSecondary">
            Parámetros
          </Typography>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1.5,
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              borderRadius: 1,
              fontSize: 12,
              overflowX: "auto",
            }}
          >
            {JSON.stringify(execution.params, null, 2)}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function Info({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="body2">{value || "—"}</Typography>
    </Box>
  );
}
