import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, Link, Typography } from "@mui/material";
import StatusChip from "../../../components/data-display/StatusChip";
import { api } from "../../../core/api/api";
import { formatDateTime } from "../orderFormat";
import SodimacBulkLabelsDialog from "./SodimacBulkLabelsDialog";

// Mientras el RPA corre, el estado se refresca solo.
const POLL_MS = 10000;

// Estado del RPA (`state` de su /status) → [etiqueta, tono].
const RPA_STATE = {
  SIN_INICIAR: ["Libre", "neutral"],
  INICIANDO: ["Iniciando", "neutral"],
  LOGIN_HOME: ["Entrando al portal", "neutral"],
  REDIRECCION_GOOGLE: ["Iniciando sesión", "neutral"],
  VALIDACION_HUMANA: ["Esperando validación", "error"],
  AUTENTICADO: ["Generando guías", "success"],
  ERROR: ["Error", "error"],
};

// El visor se incrusta en solo lectura salvo cuando hay una validación
// pendiente: así nadie hace clic por accidente en el Chrome del RPA.
const viewerSrc = (url, interactive) => (interactive ? url : `${url}&view_only=true`);

// Recuadro "RPA de guías de Sodimac": en qué va, ver en vivo (visor noVNC
// del RPA incrustado), continuar tras resolver el CAPTCHA, detener la corrida
// y "Generar guías disponibles" (lote de las OC listas; `onChanged` recarga
// el listado de pedidos).
// Contrato: backend/docs/contracts/API.md ("sodimac/rpa/status").
export default function SodimacRpaPanel({ onChanged }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { ok, data } = await api.sodimacRpaStatus();
      if (ok) setStatus(data);
    } catch {
      setStatus({ configured: true, reachable: false, error: "No se pudo conectar con el servidor." });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!status?.running) return undefined;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [status?.running, load]);

  const control = async (action, confirmText, success) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setMessage(null);
    try {
      const call = action === "kill" ? api.killSodimacRpa : api.continueSodimacRpa;
      const { ok, data } = await call();
      if (ok) {
        setStatus(data);
        setMessage({ severity: "success", text: success });
      } else {
        setMessage({ severity: "error", text: data?.detail || "El RPA no aceptó la orden." });
      }
    } catch {
      setMessage({ severity: "error", text: "No se pudo conectar con el servidor." });
    } finally {
      setBusy("");
    }
  };

  if (!status || !status.configured) return null;

  const [label, tone] = status.reachable
    ? RPA_STATE[status.running ? status.state : "SIN_INICIAR"] ?? [status.state, "neutral"]
    : ["Sin conexión", "error"];

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper", p: 1.5, mb: 2 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          RPA de guías de Sodimac
        </Typography>
        <StatusChip label={label} tone={tone} />
        {status.reachable && status.running && status.message && (
          <Typography variant="body2" color="textSecondary">
            {status.message}
            {status.updated_at && ` · ${formatDateTime(status.updated_at)}`}
          </Typography>
        )}
        {!status.reachable && (
          <Typography variant="body2" color="textSecondary" sx={{ wordBreak: "break-word" }}>
            {status.error}
          </Typography>
        )}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, ml: { sm: "auto" } }}>
          {status.reachable && !status.running && (
            <Button size="small" variant="contained" disabled={!!busy} onClick={() => setBulkOpen(true)}>
              Generar guías disponibles
            </Button>
          )}
          {status.viewer_url && (
            <Button size="small" variant={viewerOpen ? "contained" : "outlined"} onClick={() => setViewerOpen((open) => !open)}>
              {viewerOpen ? "Ocultar visor" : "Ver en vivo"}
            </Button>
          )}
          {status.waiting_human && (
            <Button
              size="small"
              variant="contained"
              disabled={!!busy}
              onClick={() => control("continue", "", "El RPA continúa.")}
            >
              Continuar
            </Button>
          )}
          {status.running && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              disabled={!!busy}
              onClick={() =>
                control(
                  "kill",
                  "Se detendrá la corrida del RPA. Las OC que no alcanzó a procesar se piden otra vez en el siguiente sync. ¿Continuar?",
                  "Corrida detenida.",
                )
              }
            >
              Detener
            </Button>
          )}
          <Button size="small" variant="text" disabled={!!busy} onClick={load}>
            Actualizar
          </Button>
        </Box>
      </Box>
      {status.waiting_human && (
        <Typography variant="body2" color="textSecondary" sx={{ mt: 0.75 }}>
          Resuelve la validación en "Ver en vivo" y luego dale "Continuar".
          {status.waiting_reason && ` (${status.waiting_reason})`}
        </Typography>
      )}
      {viewerOpen && status.viewer_url && (
        <Box sx={{ mt: 1 }}>
          <Box
            component="iframe"
            // La key fuerza a recargar el visor al cambiar de solo lectura a control.
            key={status.waiting_human ? "control" : "view"}
            title="Visor en vivo del RPA de Sodimac"
            src={viewerSrc(status.viewer_url, status.waiting_human)}
            sx={{ display: "block", width: "100%", aspectRatio: "16 / 9", border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.default" }}
          />
          <Typography variant="caption" color="textSecondary" sx={{ display: "block", mt: 0.5 }}>
            {status.waiting_human ? "Con control: resuelve la validación aquí." : "Solo lectura."} Si el visor
            no carga (el RPA lo enciende solo al aparecer un CAPTCHA), ábrelo{" "}
            <Link href={status.viewer_url} target="_blank" rel="noopener noreferrer">
              en otra pestaña
            </Link>
            .
          </Typography>
        </Box>
      )}
      {bulkOpen && (
        <SodimacBulkLabelsDialog
          onClose={() => setBulkOpen(false)}
          onSent={(count) => {
            setBulkOpen(false);
            setMessage({ severity: "success", text: `${count} OC enviadas al RPA.` });
            load();
            onChanged?.();
          }}
        />
      )}
      {message && (
        <Alert severity={message.severity} sx={{ mt: 1 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}
    </Box>
  );
}
