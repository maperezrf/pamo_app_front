import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import { api } from "../../../core/api/api";
import { formatMoney } from "../orderFormat";

// Canales que traen su propia guía: el botón la trae, no la genera.
const CHANNEL_LABELS = ["mercadolibre", "falabella"];
// La tienda web (y Addi, cotizaciones) no trae guía: se genera en Envía.
const GENERATED_LABELS = ["shopify"];

// Botones del despacho de un pedido de Shopify: traer o generar la guía y
// avisar a la bodega. Acciones manuales para probar el flujo de forma
// controlada (contrato: backend/docs/contracts/API.md, "dispatch").
export default function DispatchActions({ order, onChanged }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const dispatch = order.dispatch;
  const labelGenerated = dispatch?.label_source === "envia";
  // La bodega genera la guía de los pedidos sin guía del canal (parámetro de la bodega).
  const warehouseLabel = Boolean(dispatch?.location_creates_own_label);

  const run = async (key, call, success) => {
    setBusy(key);
    setMessage(null);
    try {
      const { ok, data } = await call();
      if (ok) {
        setMessage({ severity: "success", text: success });
        onChanged?.();
      } else {
        setMessage({ severity: "error", text: data?.detail || "No se pudo completar la acción." });
      }
    } catch {
      setMessage({ severity: "error", text: "No se pudo conectar con el servidor." });
    } finally {
      setBusy("");
    }
  };

  const notify = () => {
    const target = dispatch?.location_name || "la bodega asignada";
    if (!window.confirm(`Se avisará a ${target} por sus canales configurados. ¿Continuar?`)) return;
    run("notify", () => api.notifyDispatch(order.shopify_order_id), "Aviso procesado; revisa el estado de cada canal.");
  };

  const fetchLabel = () => {
    const warning =
      order.marketplace === "mercadolibre"
        ? "En Mercado Libre, si la guía no se ha impreso, quedará marcada como impresa. ¿Continuar?"
        : "Se traerá la guía del canal. ¿Continuar?";
    if (!window.confirm(warning)) return;
    run("label", () => api.fetchDispatchLabel(order.shopify_order_id), "Guía traída del canal.");
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1.25 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }} onClick={(e) => e.stopPropagation()}>
        {CHANNEL_LABELS.includes(order.marketplace) && (
          <Button size="small" variant="outlined" disabled={!!busy} onClick={fetchLabel}>
            {busy === "label" ? <CircularProgress size={16} /> : "Traer guía"}
          </Button>
        )}
        {GENERATED_LABELS.includes(order.marketplace) && (
          <Button
            size="small"
            variant="outlined"
            disabled={!!busy || labelGenerated || warehouseLabel}
            title={
              warehouseLabel
                ? `${dispatch.location_name} crea su propia guía`
                : labelGenerated
                  ? "Ya tiene una guía generada"
                  : undefined
            }
            onClick={() => setQuoteOpen(true)}
          >
            Generar guía
          </Button>
        )}
        <Button size="small" variant="contained" disabled={!!busy} onClick={notify}>
          {busy === "notify" ? <CircularProgress size={16} color="inherit" /> : "Notificar a proveedor"}
        </Button>
      </Box>
      {message && (
        <Alert severity={message.severity} onClose={() => setMessage(null)} sx={{ wordBreak: "break-word" }}>
          {message.text}
        </Alert>
      )}
      {quoteOpen && (
        <GenerateLabelDialog
          order={order}
          onClose={() => setQuoteOpen(false)}
          onGenerated={() => {
            setQuoteOpen(false);
            setMessage({ severity: "success", text: "Guía generada en Envía." });
            onChanged?.();
          }}
        />
      )}
    </Box>
  );
}

// Paso 1: cotizar (no cobra). Paso 2: generar la opción elegida (cobra).
function GenerateLabelDialog({ order, onClose, onGenerated }) {
  const [options, setOptions] = useState(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  // Cotiza una vez al abrir (no cobra).
  useEffect(() => {
    let ignore = false;
    api
      .quoteDispatchLabel(order.shopify_order_id)
      .then(({ ok, data }) => {
        if (ignore) return;
        if (ok) setOptions(data.options || []);
        else setError(data?.detail || "No se pudo cotizar.");
      })
      .catch(() => {
        if (!ignore) setError("No se pudo conectar con el servidor.");
      });
    return () => {
      ignore = true;
    };
  }, [order.shopify_order_id]);

  const option = options?.find((o) => `${o.carrier}|${o.service}` === selected);

  const generate = async () => {
    if (!option) return;
    setGenerating(true);
    setError("");
    try {
      const { ok, data } = await api.generateDispatchLabel(order.shopify_order_id, option);
      if (ok) onGenerated();
      else setError(data?.detail || "No se pudo generar la guía.");
    } catch {
      setError("No se pudo conectar con el servidor. No reintentes sin revisar en Envía si la guía se generó.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open onClose={generating ? undefined : onClose} fullWidth maxWidth="xs" onClick={(e) => e.stopPropagation()}>
      <DialogTitle>Generar guía · pedido {order.shopify_order_name}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2, wordBreak: "break-word" }}>{error}</Alert>}
        {options === null && !error && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {options?.length === 0 && <Typography color="textSecondary">Envía no devolvió opciones para este envío.</Typography>}
        {options?.length > 0 && (
          <RadioGroup value={selected} onChange={(e) => setSelected(e.target.value)}>
            {options.map((o) => (
              <FormControlLabel
                key={`${o.carrier}|${o.service}`}
                value={`${o.carrier}|${o.service}`}
                control={<Radio size="small" />}
                label={`${o.carrierLabel || o.carrier} · ${o.service} · ${formatMoney(o.price, o.currency)}`}
              />
            ))}
          </RadioGroup>
        )}
        <Typography variant="caption" color="textSecondary" component="p" sx={{ mt: 1.5 }}>
          Desde la bodega asignada, paquete por defecto de 1 kg (10×10×10 cm). Generar la guía cobra el envío a la
          cuenta de Envía.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose} disabled={generating}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={generate} disabled={!option || generating}>
          {generating ? <CircularProgress size={16} color="inherit" /> : option ? `Generar (${formatMoney(option.price, option.currency)})` : "Generar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
