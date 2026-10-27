import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import { describeSchedule, errorMessage } from "../processFormat";

// Confirmación de borrado de una programación. Las ejecuciones que disparó
// se conservan en el historial. Para detenerla sin borrarla, pausarla.
export default function DeleteScheduleDialog({ schedule, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const confirm = async () => {
    setDeleting(true);
    setError("");
    try {
      const { ok, status, data } = await api.deleteSchedule(schedule.id);
      // 404: ya no existía (otra persona la borró); el resultado es el mismo.
      if (ok || status === 404) onDeleted();
      else if (status === 403) setError("No tienes permiso para eliminar programaciones.");
      else setError(errorMessage(data, "No se pudo eliminar."));
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onClose={deleting ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>Eliminar programación #{schedule.id}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        <Typography variant="body2">
          <b>{schedule.process_type_name}</b> dejará de correr: {describeSchedule(schedule).toLowerCase()}. Su historial
          de ejecuciones se conserva. Si solo quieres detenerla un tiempo, mejor páusala.
        </Typography>
        <Typography variant="body2" color="error">
          No se puede deshacer.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancelar
        </Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={deleting}>
          {deleting ? "Eliminando…" : "Eliminar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
