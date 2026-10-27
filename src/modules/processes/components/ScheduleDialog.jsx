import { useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../core/api/api";
import { SCHEDULE_KIND_OPTIONS, WEEKDAYS, errorMessage } from "../processFormat";

function initialForm(schedule) {
  return {
    process_type: schedule?.process_type ?? "",
    schedule_kind: schedule?.schedule_kind ?? "DAILY",
    run_at_date: schedule?.run_at_date ?? "",
    run_at_time: schedule?.run_at_time?.slice(0, 5) ?? "",
    weekday: schedule?.weekday ?? 0,
    day_of_month: schedule?.day_of_month ?? 1,
    cron_expression: schedule?.cron_expression ?? "",
    params: schedule?.params && Object.keys(schedule.params).length ? JSON.stringify(schedule.params, null, 2) : "",
    is_active: schedule?.is_active ?? true,
  };
}

// Crear (`schedule` vacío) o editar una programación. Solo se envían los
// campos del tipo elegido; el backend vacía el resto y valida.
export default function ScheduleDialog({ schedule, processTypes, onClose, onSaved }) {
  const [form, setForm] = useState(() => initialForm(schedule));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isEdit = Boolean(schedule);
  const kind = form.schedule_kind;
  const usesTime = kind !== "CRON";

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const save = async () => {
    let params = null;
    if (form.params.trim()) {
      try {
        params = JSON.parse(form.params);
      } catch {
        setError("Los parámetros no son un JSON válido.");
        return;
      }
    }

    const body = {
      process_type: form.process_type,
      schedule_kind: kind,
      params,
      is_active: form.is_active,
      run_at_date: kind === "ONCE_DATE" ? form.run_at_date || null : null,
      run_at_time: usesTime ? form.run_at_time || null : null,
      weekday: kind === "WEEKLY" ? form.weekday : null,
      day_of_month: kind === "MONTHLY" ? Number(form.day_of_month) : null,
      cron_expression: kind === "CRON" ? form.cron_expression.trim() : null,
    };

    setSaving(true);
    setError("");
    try {
      const { ok, status, data } = isEdit
        ? await api.updateSchedule(schedule.id, body)
        : await api.createSchedule(body);
      if (ok) onSaved();
      else if (status === 403) setError("No tienes permiso para guardar programaciones.");
      else setError(errorMessage(data, "No se pudo guardar la programación."));
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{isEdit ? `Editar programación #${schedule.id}` : "Nueva programación"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        <TextField select label="Proceso" value={form.process_type} onChange={set("process_type")} required>
          {processTypes.map((type) => (
            <MenuItem key={type.id} value={type.id}>
              {type.name}
            </MenuItem>
          ))}
        </TextField>

        <TextField select label="Frecuencia" value={kind} onChange={set("schedule_kind")}>
          {SCHEDULE_KIND_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>

        {kind === "ONCE_DATE" && (
          <TextField
            type="date"
            label="Fecha"
            value={form.run_at_date}
            onChange={set("run_at_date")}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
        {kind === "WEEKLY" && (
          <TextField select label="Día de la semana" value={form.weekday} onChange={set("weekday")}>
            {WEEKDAYS.map((label, index) => (
              <MenuItem key={label} value={index}>
                {label}
              </MenuItem>
            ))}
          </TextField>
        )}
        {kind === "MONTHLY" && (
          <TextField
            type="number"
            label="Día del mes"
            value={form.day_of_month}
            onChange={set("day_of_month")}
            helperText="Un mes sin ese día (ej. 31) no corre."
            slotProps={{ htmlInput: { min: 1, max: 31 } }}
          />
        )}
        {usesTime && (
          <TextField
            type="time"
            label="Hora (Colombia)"
            value={form.run_at_time}
            onChange={set("run_at_time")}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        )}
        {kind === "CRON" && (
          <TextField
            label="Expresión CRON"
            value={form.cron_expression}
            onChange={set("cron_expression")}
            placeholder="0 5 * * *"
            helperText="minuto hora día mes día-semana, en hora de Colombia. Ej: 0 8-18 * * 1-5"
            slotProps={{ htmlInput: { style: { fontFamily: "monospace" } } }}
          />
        )}

        <TextField
          label="Parámetros (JSON, opcional)"
          value={form.params}
          onChange={set("params")}
          multiline
          minRows={2}
          placeholder="{}"
          slotProps={{ htmlInput: { style: { fontFamily: "monospace", fontSize: 13 } } }}
        />

        <FormControlLabel
          control={
            <Switch
              checked={form.is_active}
              onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
            />
          }
          label="Activa"
        />
        {!form.is_active && (
          <Typography variant="body2" color="textSecondary">
            Pausada: se guarda pero no corre hasta activarla.
          </Typography>
        )}

        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={save} disabled={saving || !form.process_type}>
          {saving ? "Guardando…" : "Guardar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
