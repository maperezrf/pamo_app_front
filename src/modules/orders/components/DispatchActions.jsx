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
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../core/api/api";
import { formatMoney } from "../orderFormat";

// Canales que traen su propia guía: el botón la trae, no la genera. (La de
// Sodimac la genera el RPA y el aviso la toma sola: no lleva botón.)
const CHANNEL_LABELS = ["mercadolibre", "falabella"];
// Sin guía del canal: se genera en Envía. Tienda web (y Addi, cotizaciones)
// y Madecentro.
const GENERATED_LABELS = ["shopify", "madecentro"];
// Paquete de la guía en Envía (kg y cm); arranca en el por defecto del backend.
const PACKAGE_FIELDS = [
  { key: "weight", label: "Peso (kg)" },
  { key: "length", label: "Largo (cm)" },
  { key: "width", label: "Ancho (cm)" },
  { key: "height", label: "Alto (cm)" },
];
const DEFAULT_PACKAGE = { weight: "1", length: "10", width: "10", height: "10" };
const toNumber = (value) => Number(String(value).trim().replace(",", "."));

// Botones de UN despacho de un pedido de Shopify (`dispatch`, null si aún
// no existe): traer o generar la guía y avisar a la bodega. Un pedido que
// Shopify repartió tiene un despacho por bodega, cada uno con sus botones.
// Acciones manuales para probar el flujo de forma controlada (contrato:
// backend/docs/contracts/API.md, "dispatches").
export default function DispatchActions({ order, dispatch, onChanged }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const dispatchId = dispatch?.id;
  const labelGenerated = dispatch?.label_source === "envia";
  // Aviso por bodega de un pedido repartido: fase 2 (todavía no disponible).
  const splitNotify = Boolean(dispatch?.split);
  // La bodega genera la guía de los pedidos de la tienda web (parámetro de la bodega).
  const warehouseLabel = order.marketplace === "shopify" && Boolean(dispatch?.location_creates_own_label);

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
    run(
      "notify",
      () => api.notifyDispatch(order.shopify_order_id, dispatchId),
      "Aviso procesado; revisa el estado de cada canal.",
    );
  };

  const fetchLabel = () => {
    const warning =
      order.marketplace === "mercadolibre"
        ? "En Mercado Libre, si la guía no se ha impreso, quedará marcada como impresa. ¿Continuar?"
        : "Se traerá la guía del canal. ¿Continuar?";
    if (!window.confirm(warning)) return;
    run("label", () => api.fetchDispatchLabel(order.shopify_order_id, dispatchId), "Guía traída del canal.");
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
        <Button
          size="small"
          variant="contained"
          disabled={!!busy || splitNotify}
          title={splitNotify ? "Pedido repartido en varias bodegas: el aviso por bodega aún no está disponible" : undefined}
          onClick={notify}
        >
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
          dispatch={dispatch}
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

// Paso 1: cotizar (no cobra) con el peso y las medidas del paquete. Paso 2:
// generar la opción elegida (cobra) con el MISMO paquete cotizado: si se
// cambia una medida, las opciones dejan de valer hasta cotizar de nuevo.
function GenerateLabelDialog({ order, dispatch, onClose, onGenerated }) {
  const dispatchId = dispatch?.id;
  const [pkg, setPkg] = useState(DEFAULT_PACKAGE);
  const [quoted, setQuoted] = useState(null); // paquete de la última cotización (del backend)
  const [quoting, setQuoting] = useState(false);
  const [options, setOptions] = useState(null);
  const [route, setRoute] = useState(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const stale = !quoted || PACKAGE_FIELDS.some(({ key }) => toNumber(pkg[key]) !== quoted[key]);
  const invalid = PACKAGE_FIELDS.some(({ key }) => !(toNumber(pkg[key]) > 0));

  const runQuote = async (values, isIgnored = () => false) => {
    setQuoting(true);
    setError("");
    setSelected("");
    try {
      const { ok, data } = await api.quoteDispatchLabel(order.shopify_order_id, dispatchId, values);
      if (isIgnored()) return;
      if (ok) {
        setOptions(data.options || []);
        setRoute(data.route || null);
        setQuoted(data.package || null);
      } else {
        setError(data?.detail || "No se pudo cotizar.");
      }
    } catch {
      if (!isIgnored()) setError("No se pudo conectar con el servidor.");
    } finally {
      if (!isIgnored()) setQuoting(false);
    }
  };

  // Cotiza al abrir con el paquete por defecto (no cobra).
  useEffect(() => {
    let ignore = false;
    runQuote(DEFAULT_PACKAGE, () => ignore);
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.shopify_order_id, dispatchId]);

  const option = !stale ? options?.find((o) => `${o.carrier}|${o.service}` === selected) : undefined;

  const generate = async () => {
    if (!option) return;
    setGenerating(true);
    setError("");
    try {
      const { ok, data } = await api.generateDispatchLabel(order.shopify_order_id, dispatchId, { ...option, pkg: quoted });
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
      <DialogTitle>
        Generar guía · pedido {order.shopify_order_name}
        {dispatch?.split && dispatch.location_name ? ` · ${dispatch.location_name}` : ""}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2, wordBreak: "break-word" }}>{error}</Alert>}
        {route && <RouteSummary route={route} />}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: 1, mb: 1 }}>
          {PACKAGE_FIELDS.map(({ key, label }) => (
            <TextField
              key={key}
              size="small"
              label={label}
              value={pkg[key]}
              disabled={generating}
              error={!(toNumber(pkg[key]) > 0)}
              onChange={(e) => setPkg((current) => ({ ...current, [key]: e.target.value }))}
              slotProps={{ htmlInput: { inputMode: "decimal" } }}
            />
          ))}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <Button
            size="small"
            variant={stale && quoted ? "contained" : "outlined"}
            disabled={quoting || generating || invalid || !stale}
            onClick={() => runQuote(Object.fromEntries(PACKAGE_FIELDS.map(({ key }) => [key, toNumber(pkg[key])])))}
          >
            {quoting ? <CircularProgress size={16} color="inherit" /> : "Cotizar"}
          </Button>
          {stale && quoted && !quoting && (
            <Typography variant="caption" color="warning.main">
              Cambiaste el paquete: cotiza de nuevo antes de generar.
            </Typography>
          )}
        </Box>
        {quoting && options === null && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {!stale && options?.length === 0 && (
          <Typography color="textSecondary">Envía no devolvió opciones para este envío.</Typography>
        )}
        {!stale && options?.length > 0 && (
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
          Desde la bodega asignada, con el peso y las medidas de arriba (la guía se genera con el paquete cotizado).
          Generar la guía cobra el envío a la cuenta de Envía.
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

// Desde dónde sale y a quién llega la guía, para revisarlo antes de pagar.
function RouteSummary({ route }) {
  const { origin, destination } = route;
  const place = (...parts) => parts.filter(Boolean).join(", ");
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mb: 2 }}>
      <Box>
        <Typography variant="caption" color="textSecondary" component="div">
          Envío desde
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {origin.name}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {origin.city || "—"}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="textSecondary" component="div">
          Entrega a
        </Typography>
        <Typography variant="body2" fontWeight={600}>
          {destination.name || "—"}
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ wordBreak: "break-word" }}>
          {destination.address || "—"}
        </Typography>
        <Typography variant="body2" color="textSecondary">
          {place(destination.city, destination.region) || "—"}
          {destination.phone && ` · ${destination.phone}`}
        </Typography>
      </Box>
    </Box>
  );
}
