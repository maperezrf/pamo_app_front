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
  IconButton,
  Radio,
  RadioGroup,
  TextField,
  Typography,
  Autocomplete,
} from "@mui/material";
import { api } from "../../../core/api/api";
import { formatMoney } from "../orderFormat";
import FileField from "./FileField";

// Canales que traen su propia guía: el botón la trae, no la genera. (La de
// Sodimac la genera el RPA y el aviso la toma sola: no lleva botón.)
const CHANNEL_LABELS = ["mercadolibre", "falabella"];
// Sin guía del canal: se genera en Envía. Tienda web (y Addi, cotizaciones)
// y Madecentro.
const GENERATED_LABELS = ["shopify", "madecentro"];
// Cajas de la guía en Envía (kg y cm), todas en UNA guía; cada fila con su
// cantidad de cajas iguales. Arranca en el paquete por defecto del backend.
const PACKAGE_FIELDS = [
  { key: "weight", label: "Peso (kg)" },
  { key: "length", label: "Largo (cm)" },
  { key: "width", label: "Ancho (cm)" },
  { key: "height", label: "Alto (cm)" },
];
const DEFAULT_PACKAGE = { weight: "1", length: "10", width: "10", height: "10", quantity: "1" };
const MAX_PACKAGE_ROWS = 20;
const MAX_PACKAGE_QUANTITY = 50;
// Transportadoras sugeridas al cargar una guía (va a Shopify como empresa de
// envío); se puede escribir otra.
const CARRIERS = ["TCC", "Servientrega", "Coordinadora", "Inter Rapidísimo", "Envía", "Deprisa"];
const toNumber = (value) => Number(String(value).trim().replace(",", "."));
const validQuantity = (value) =>
  /^\d{1,3}$/.test(String(value).trim()) && toNumber(value) >= 1 && toNumber(value) <= MAX_PACKAGE_QUANTITY;
// Fila del formulario → la que se manda (y la que devuelve el backend).
const toPackage = (row) => ({
  ...Object.fromEntries(PACKAGE_FIELDS.map(({ key }) => [key, toNumber(row[key])])),
  quantity: toNumber(row.quantity),
});
const PACKAGE_KEYS = [...PACKAGE_FIELDS.map(({ key }) => key), "quantity"];
const samePackages = (rows, quoted) =>
  rows.length === quoted.length &&
  rows.every((row, index) => PACKAGE_KEYS.every((key) => toPackage(row)[key] === quoted[index][key]));

// Botones de UN despacho de un pedido de Shopify (`dispatch`, null si aún
// no existe): traer o generar la guía y avisar a la bodega. Un pedido que
// Shopify repartió tiene un despacho por bodega, cada uno con sus botones.
// Acciones manuales para probar el flujo de forma controlada (contrato:
// backend/docs/contracts/API.md, "dispatches").
export default function DispatchActions({ order, dispatch, onChanged }) {
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const dispatchId = dispatch?.id;
  // Guía generada en Envía o cargada a mano: guardada en el despacho.
  const labelGenerated = ["envia", "manual"].includes(dispatch?.label_source);
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
    const part = dispatch?.split ? " solo con sus productos (el pedido sale de varias bodegas)" : "";
    if (!window.confirm(`Se avisará a ${target} por sus canales configurados${part}. ¿Continuar?`)) return;
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

  // La guía se puede liberar mientras no se haya avisado a la bodega ni
  // cumplido en Shopify (el backend lo vuelve a validar).
  const canRelease = labelGenerated && !dispatch?.notifications?.length && !dispatch?.shopify_fulfilled_at;
  const releaseLabel = () => {
    const label = `${dispatch.tracking_number} (${[dispatch.label_carrier, dispatch.label_service].filter(Boolean).join(" ")})`;
    const cancel =
      dispatch.label_source === "envia"
        ? "NO se cancela en Envía: cancélala allá para que no se cobre."
        : "Si no se va a usar, anúlala donde se hizo.";
    if (!window.confirm(`Se quitará la guía ${label} del despacho para generar o cargar otra. ${cancel} ¿Continuar?`))
      return;
    run(
      "release",
      () => api.releaseDispatchLabel(order.shopify_order_id, dispatchId),
      `Guía ${dispatch.tracking_number} liberada.${dispatch.label_source === "envia" ? " Recuerda cancelarla en Envía." : ""}`,
    );
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
        {GENERATED_LABELS.includes(order.marketplace) && (
          <Button
            size="small"
            variant="outlined"
            disabled={!!busy || labelGenerated || warehouseLabel}
            title={
              warehouseLabel
                ? `${dispatch.location_name} crea su propia guía`
                : labelGenerated
                  ? "Ya tiene una guía: libérala primero"
                  : "Subir una guía hecha fuera del sistema"
            }
            onClick={() => setUploadOpen(true)}
          >
            Cargar guía
          </Button>
        )}
        {canRelease && (
          <Button size="small" variant="outlined" color="warning" disabled={!!busy} onClick={releaseLabel}>
            {busy === "release" ? <CircularProgress size={16} /> : "Liberar guía"}
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          disabled={!!busy}
          title={dispatch?.split ? "Avisa solo a esta bodega, con sus productos" : undefined}
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
      {uploadOpen && (
        <UploadDispatchLabelDialog
          order={order}
          dispatch={dispatch}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            setMessage({ severity: "success", text: "Guía cargada." });
            onChanged?.();
          }}
        />
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

// Guía hecha fuera del sistema (panel de Envía, transportadora): PDF, número
// y transportadora, que es la que queda en Shopify al cumplir.
function UploadDispatchLabelDialog({ order, dispatch, onClose, onUploaded }) {
  const [label, setLabel] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const { ok, data } = await api.uploadDispatchLabel(order.shopify_order_id, dispatch?.id, {
        label,
        trackingNumber: trackingNumber.trim(),
        carrier: carrier.trim(),
      });
      if (ok) onUploaded();
      else setError(data?.detail || "No se pudo cargar la guía.");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs" onClick={(e) => e.stopPropagation()}>
      <DialogTitle>Cargar guía · pedido {order.shopify_order_name}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        <FileField label="Guía (PDF)" file={label} onChange={setLabel} />
        <TextField
          size="small"
          label="Número de guía"
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
        />
        <Autocomplete
          freeSolo
          options={CARRIERS}
          inputValue={carrier}
          onInputChange={(_, value) => setCarrier(value)}
          renderInput={(params) => <TextField {...params} size="small" label="Transportadora" />}
        />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button
          variant="contained"
          onClick={submit}
          disabled={saving || !label || !trackingNumber.trim() || !carrier.trim()}
        >
          {saving ? "Cargando…" : "Cargar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Paso 1: cotizar (no cobra) con las cajas: peso, medidas y cantidad por
// fila ("+ Agregar paquete" suma una fila). Paso 2: generar la opción
// elegida (cobra) con las MISMAS cajas cotizadas, en una sola guía: si se
// cambia algo, las opciones dejan de valer hasta cotizar de nuevo.
function GenerateLabelDialog({ order, dispatch, onClose, onGenerated }) {
  const dispatchId = dispatch?.id;
  const [rows, setRows] = useState([DEFAULT_PACKAGE]);
  const [quoted, setQuoted] = useState(null); // cajas de la última cotización (del backend)
  const [quoting, setQuoting] = useState(false);
  const [options, setOptions] = useState(null);
  const [route, setRoute] = useState(null);
  const [selected, setSelected] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);

  const stale = !quoted || !samePackages(rows, quoted);
  const invalid = rows.some(
    (row) => PACKAGE_FIELDS.some(({ key }) => !(toNumber(row[key]) > 0)) || !validQuantity(row.quantity),
  );
  const boxes = rows.reduce((total, row) => total + (validQuantity(row.quantity) ? toNumber(row.quantity) : 0), 0);
  const setRow = (index, key, value) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [key]: value } : row)));

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
        setQuoted(data.packages || null);
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
    runQuote([toPackage(DEFAULT_PACKAGE)], () => ignore);
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
      const { ok, data } = await api.generateDispatchLabel(order.shopify_order_id, dispatchId, { ...option, packages: quoted });
      if (ok) onGenerated();
      else setError(data?.detail || "No se pudo generar la guía.");
    } catch {
      setError("No se pudo conectar con el servidor. No reintentes sin revisar en Envía si la guía se generó.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open onClose={generating ? undefined : onClose} fullWidth maxWidth="sm" onClick={(e) => e.stopPropagation()}>
      <DialogTitle>
        Generar guía · pedido {order.shopify_order_name}
        {dispatch?.split && dispatch.location_name ? ` · ${dispatch.location_name}` : ""}
      </DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2, wordBreak: "break-word" }}>{error}</Alert>}
        {route && <RouteSummary route={route} />}
        {rows.map((row, index) => (
          <Box
            key={index}
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr) 0.8fr auto" },
              gap: 1,
              mb: 1,
              alignItems: "center",
            }}
          >
            {PACKAGE_FIELDS.map(({ key, label }) => (
              <TextField
                key={key}
                size="small"
                label={label}
                value={row[key]}
                disabled={generating}
                error={!(toNumber(row[key]) > 0)}
                onChange={(e) => setRow(index, key, e.target.value)}
                slotProps={{ htmlInput: { inputMode: "decimal" } }}
              />
            ))}
            <TextField
              size="small"
              label="Cantidad"
              value={row.quantity}
              disabled={generating}
              error={!validQuantity(row.quantity)}
              onChange={(e) => setRow(index, "quantity", e.target.value)}
              slotProps={{ htmlInput: { inputMode: "numeric" } }}
            />
            <IconButton
              size="small"
              aria-label="Quitar paquete"
              title="Quitar paquete"
              disabled={generating || rows.length === 1}
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
            >
              ×
            </IconButton>
          </Box>
        ))}
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
          <Button
            size="small"
            disabled={generating || rows.length >= MAX_PACKAGE_ROWS}
            onClick={() => setRows((current) => [...current, DEFAULT_PACKAGE])}
          >
            + Agregar paquete
          </Button>
          <Button
            size="small"
            variant={stale && quoted ? "contained" : "outlined"}
            disabled={quoting || generating || invalid || !stale}
            onClick={() => runQuote(rows.map(toPackage))}
          >
            {quoting ? <CircularProgress size={16} color="inherit" /> : "Cotizar"}
          </Button>
          {boxes > 1 && (
            <Typography variant="caption" color="textSecondary">
              {boxes} cajas en una sola guía
            </Typography>
          )}
          {stale && quoted && !quoting && (
            <Typography variant="caption" color="warning.main">
              Cambiaste los paquetes: cotiza de nuevo antes de generar.
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
          Desde la bodega asignada, con los paquetes de arriba en una sola guía (se genera con los paquetes cotizados).
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
