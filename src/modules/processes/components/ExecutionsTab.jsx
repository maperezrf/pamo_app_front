import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Chip, LinearProgress, MenuItem, TextField, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import { formatDateTime } from "../../../core/format";
import DataTable from "../../../components/tables/DataTable";
import StatusChip from "../../../components/data-display/StatusChip";
import ExecutionExpandedDetail from "./ExecutionExpandedDetail";
import { EXECUTION_STATUS_OPTIONS, errorMessage, executionStatus, formatDuration } from "../processFormat";

// Mientras la página tenga ejecuciones activas se recarga sola.
const REFRESH_MS = 5000;

// Quién la disparó: una programación, una persona, o el propio sistema
// (webhooks y lanzamientos internos no tienen ni usuario ni programación).
function executionOrigin(execution) {
  if (execution.triggered_by_schedule) return `Programación #${execution.triggered_by_schedule}`;
  if (execution.user_email) return execution.user_email;
  return "Automática";
}

// Historial de ejecuciones (`GET /api/orchestrator/executions/`, paginado).
// Filtros y página viven en la URL, los maneja `ProcessesPage`.
export default function ExecutionsTab({
  processTypes,
  filters,
  page,
  pageSize,
  pageSizeOptions,
  onQueryChange,
  onClearFilters,
}) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const silent = useRef(false);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let ignore = false;
    const params = { page, page_size: pageSize };
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params[key] = value;
    });

    // La recarga automática no muestra la barra de carga para no parpadear.
    if (!silent.current) setLoading(true);
    silent.current = false;
    api
      .listExecutions(params)
      .then(({ ok, status, data }) => {
        if (ignore) return;
        if (ok) {
          setResult(data);
          setError("");
        } else if (status === 404 && page > 1) {
          onQueryChange({ page: "" }, { resetPage: false });
        } else if (status === 403) {
          setError("No tienes permiso para ver las ejecuciones.");
        } else {
          setError("No se pudo obtener el historial de ejecuciones.");
        }
      })
      .catch(() => {
        if (!ignore) setError("No se pudo conectar con el servidor.");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [filters, page, pageSize, reloadKey, onQueryChange]);

  const rows = useMemo(() => result?.results ?? [], [result]);
  const hasActive = rows.some((row) => executionStatus(row.status).active);

  useEffect(() => {
    if (!hasActive) return undefined;
    const timer = setTimeout(() => {
      silent.current = true;
      reload();
    }, REFRESH_MS);
    return () => clearTimeout(timer);
  }, [hasActive, result, reload]);

  const cancel = useCallback(
    async (execution) => {
      setCancelling(execution.id);
      try {
        const { ok, status, data } = await api.cancelExecution(execution.id);
        if (ok) reload();
        else if (status === 403) setError("No tienes permiso para cancelar ejecuciones.");
        else setError(errorMessage(data, "No se pudo cancelar la ejecución."));
      } catch {
        setError("No se pudo conectar con el servidor.");
      } finally {
        setCancelling(null);
      }
    },
    [reload],
  );

  const columns = useMemo(
    () => [
      { id: "created_at", header: "Fecha", cell: ({ row }) => formatDateTime(row.original.created_at) },
      {
        id: "process",
        header: "Proceso",
        cell: ({ row: { original: e } }) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {e.process_type_name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              #{e.id} · {e.process_type_code}
            </Typography>
          </Box>
        ),
      },
      { id: "origin", header: "Origen", cell: ({ row }) => executionOrigin(row.original) },
      {
        id: "status",
        header: "Estado",
        cell: ({ row: { original: e } }) => {
          const status = executionStatus(e.status);
          return (
            <Box sx={{ minWidth: 120 }}>
              <StatusChip label={status.label} tone={status.tone} title={e.error_message || e.current_step || ""} />
              {e.status === "EJECUTANDO" && (
                <LinearProgress variant="determinate" value={e.progress_percent} sx={{ mt: 0.75 }} />
              )}
            </Box>
          );
        },
      },
      {
        id: "duration",
        header: "Duración",
        meta: { align: "right" },
        cell: ({ row }) => formatDuration(row.original.duration_seconds),
      },
      {
        id: "actions",
        header: "",
        meta: { align: "right" },
        cell: ({ row: { original: e } }) => {
          if (!["PENDIENTE", "EN_COLA", "EJECUTANDO"].includes(e.status)) return null;
          return (
            <Button
              size="small"
              color="error"
              disabled={cancelling === e.id}
              onClick={(event) => {
                event.stopPropagation();
                cancel(e);
              }}
            >
              Cancelar
            </Button>
          );
        },
      },
    ],
    [cancel, cancelling],
  );

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
        <TextField
          select
          size="small"
          label="Proceso"
          value={filters.process_type}
          onChange={(e) => onQueryChange({ process_type: e.target.value })}
          sx={{ width: { xs: "100%", sm: 300 } }}
        >
          <MenuItem value="">Todos</MenuItem>
          {processTypes.map((type) => (
            <MenuItem key={type.code} value={type.code}>
              {type.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Estado"
          value={filters.status}
          onChange={(e) => onQueryChange({ status: e.target.value })}
          sx={{ width: { xs: "100%", sm: 180 } }}
        >
          <MenuItem value="">Todos</MenuItem>
          {EXECUTION_STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        {filters.schedule && (
          <Chip label={`Programación #${filters.schedule}`} onDelete={() => onQueryChange({ schedule: "" })} />
        )}
        {hasFilters && (
          <Button color="inherit" size="small" onClick={onClearFilters}>
            Limpiar filtros
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        {result && (
          <Typography variant="body2" color="textSecondary">
            {result.count} {result.count === 1 ? "ejecución" : "ejecuciones"}
          </Typography>
        )}
        <Button size="small" variant="outlined" onClick={reload} disabled={loading}>
          Actualizar
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={rows}
        loading={loading}
        getRowId={(row) => String(row.id)}
        renderExpanded={(execution) => <ExecutionExpandedDetail execution={execution} />}
        emptyMessage="No hay ejecuciones con estos filtros."
        pagination={{
          page,
          pageSize,
          count: result?.count ?? 0,
          onPageChange: (next) => onQueryChange({ page: next > 1 ? next : "" }, { resetPage: false }),
          pageSizeOptions,
          onPageSizeChange: (size) => onQueryChange({ page_size: size === pageSizeOptions[0] ? "" : size }),
        }}
      />
    </Box>
  );
}
