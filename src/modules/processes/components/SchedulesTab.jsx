import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Switch, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import { formatDateTime } from "../../../core/format";
import DataTable from "../../../components/tables/DataTable";
import ScheduleDialog from "./ScheduleDialog";
import DeleteScheduleDialog from "./DeleteScheduleDialog";
import { describeSchedule, errorMessage } from "../processFormat";

// Programaciones del orquestador (`/api/orchestrator/schedules/`): pocas
// filas, se traen todas. Los cambios aplican en caliente en el scheduler.
export default function SchedulesTab({ processTypes, onShowHistory }) {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(null);
  // {type: "edit", schedule} | {type: "create"} | {type: "delete", schedule}
  const [dialog, setDialog] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .listSchedules()
      .then(({ ok, status, data }) => {
        if (ok) {
          setSchedules(data);
          setError("");
        } else if (status === 403) setError("No tienes permiso para ver las programaciones.");
        else setError("No se pudo obtener las programaciones.");
      })
      .catch(() => setError("No se pudo conectar con el servidor."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const toggleActive = useCallback(
    async (schedule) => {
      setBusy(schedule.id);
      setNotice("");
      try {
        const { ok, data } = await api.updateSchedule(schedule.id, { is_active: !schedule.is_active });
        if (ok) setSchedules((rows) => rows.map((row) => (row.id === data.id ? data : row)));
        else setError(errorMessage(data, "No se pudo cambiar la programación."));
      } catch {
        setError("No se pudo conectar con el servidor.");
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  // "Ejecutar ahora": lanza el proceso con los parámetros de la programación.
  // 409 = ya hay una ejecución activa de ese proceso.
  const runNow = useCallback(async (schedule) => {
    setBusy(schedule.id);
    setNotice("");
    try {
      const { ok, status, data } = await api.launchProcess(schedule.process_type_code, schedule.params);
      if (ok) {
        setError("");
        setNotice(`${schedule.process_type_name}: ejecución #${data.execution_id} lanzada.`);
      } else if (status === 409) setError(`${schedule.process_type_name} ya se está ejecutando.`);
      else setError(errorMessage(data, "No se pudo lanzar el proceso."));
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy(null);
    }
  }, []);

  const columns = useMemo(
    () => [
      {
        id: "process",
        header: "Proceso",
        accessorFn: (row) => row.process_type_name,
        cell: ({ row: { original: s } }) => (
          <Box>
            <Typography variant="body2" fontWeight={600}>
              {s.process_type_name}
            </Typography>
            <Typography variant="caption" color="textSecondary">
              #{s.id} · {s.process_type_code}
            </Typography>
          </Box>
        ),
      },
      { id: "when", header: "Cuándo (hora Colombia)", enableSorting: false, cell: ({ row }) => describeSchedule(row.original) },
      {
        id: "next_run_at",
        header: "Próxima corrida",
        accessorFn: (row) => row.next_run_at ?? "",
        cell: ({ row: { original: s } }) => (s.is_active ? formatDateTime(s.next_run_at) : "Pausada"),
      },
      {
        id: "is_active",
        header: "Activa",
        enableSorting: false,
        cell: ({ row: { original: s } }) => (
          <Switch
            size="small"
            checked={s.is_active}
            disabled={busy === s.id}
            onClick={(e) => e.stopPropagation()}
            onChange={() => toggleActive(s)}
            slotProps={{ input: { "aria-label": s.is_active ? "Pausar" : "Activar" } }}
          />
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        meta: { align: "right" },
        cell: ({ row: { original: s } }) => (
          <Box sx={{ display: "flex", justifyContent: "flex-end", flexWrap: "wrap", gap: 0.5 }}>
            <Button size="small" disabled={busy === s.id} onClick={() => runNow(s)}>
              Ejecutar ahora
            </Button>
            <Button size="small" onClick={() => onShowHistory(s.id)}>
              Historial
            </Button>
            <Button size="small" onClick={() => setDialog({ type: "edit", schedule: s })}>
              Editar
            </Button>
            <Button size="small" color="error" onClick={() => setDialog({ type: "delete", schedule: s })}>
              Eliminar
            </Button>
          </Box>
        ),
      },
    ],
    [busy, onShowHistory, runNow, toggleActive],
  );

  const closeAndReload = () => {
    setDialog(null);
    load();
  };

  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, alignItems: "center", mb: 2 }}>
        <Typography variant="body2" color="textSecondary" sx={{ flexGrow: 1 }}>
          {schedules.length} {schedules.length === 1 ? "programación" : "programaciones"}
        </Typography>
        <Button variant="contained" onClick={() => setDialog({ type: "create" })} disabled={!processTypes.length}>
          Nueva programación
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {notice && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}

      <DataTable
        columns={columns}
        data={schedules}
        loading={loading}
        searchable={false}
        getRowId={(row) => String(row.id)}
        emptyMessage="No hay programaciones."
      />

      {(dialog?.type === "create" || dialog?.type === "edit") && (
        <ScheduleDialog
          schedule={dialog.schedule}
          processTypes={processTypes}
          onClose={() => setDialog(null)}
          onSaved={closeAndReload}
        />
      )}
      {dialog?.type === "delete" && (
        <DeleteScheduleDialog schedule={dialog.schedule} onClose={() => setDialog(null)} onDeleted={closeAndReload} />
      )}
    </Box>
  );
}
