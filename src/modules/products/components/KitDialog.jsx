import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../core/api/api";
import { downloadSheet, readSheetRows } from "../../../core/excel";
import { errorMessage, KIT_COLUMNS } from "../productFormat";
import ExcelFileField from "./ExcelFileField";

const EMPTY_COMPONENT = { sku: "", quantity: 1 };

// Carga de kits (`POST /api/products/kits/`): un kit en formulario o varios
// desde Excel. Cada kit que viene REEMPLAZA completo sus componentes; si una
// fila del kit es inválida, ese kit no se toca. No valida contra Shopify.
// `kit` (producto del listado) abre el formulario en modo edición.
export default function KitDialog({ kit, onClose, onSaved }) {
  const [mode, setMode] = useState("form");
  const [kitSku, setKitSku] = useState(kit?.sku ?? "");
  const [components, setComponents] = useState(
    kit?.components?.length ? kit.components.map((c) => ({ sku: c.sku, quantity: c.quantity })) : [{ ...EMPTY_COMPONENT }],
  );
  const [file, setFile] = useState(null);
  const [fileRows, setFileRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const updateComponent = (index, changes) =>
    setComponents(components.map((component, i) => (i === index ? { ...component, ...changes } : component)));

  const formRows = () => {
    const sku = kitSku.trim();
    const rows = components
      .filter((component) => component.sku.trim())
      .map((component) => ({ kit_sku: sku, component_sku: component.sku.trim(), quantity: component.quantity }));
    return sku && rows.length ? rows : null;
  };

  const rowsToSend = mode === "form" ? formRows() : fileRows;

  const chooseFile = async (selected) => {
    setFile(selected);
    setFileRows(null);
    setError("");
    setResult(null);
    if (!selected) return;
    try {
      const rows = await readSheetRows(selected);
      if (!rows.length) setError("El archivo no tiene filas.");
      else setFileRows(rows);
    } catch {
      setError("No se pudo leer el archivo. Debe ser un Excel (.xlsx, .xls) o CSV.");
    }
  };

  const downloadKits = async () => {
    setDownloading(true);
    setError("");
    try {
      const { ok, data } = await api.exportKits();
      if (ok) await downloadSheet("kits.xlsx", data.columns, data.rows);
      else setError("No se pudieron descargar los kits.");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDownloading(false);
    }
  };

  const submit = async () => {
    if (!rowsToSend) return;
    setSaving(true);
    setError("");
    setResult(null);
    try {
      const { ok, status, data } = await api.importKits(rowsToSend);
      if (ok) {
        setResult(data);
        if (data.created || data.updated) onSaved?.();
      } else if (status === 403) setError("No tienes permiso para cargar kits.");
      else if (data?.unknown_columns) setError(`Columnas desconocidas: ${data.unknown_columns.join(", ")}.`);
      else setError(errorMessage(data, "No se pudo cargar."));
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  const savedOk = result && !result.errors.length;

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{kit ? `Editar kit ${kit.sku}` : "Cargar kits"}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {!kit && (
          <Tabs
            value={mode}
            onChange={(_, value) => {
              setMode(value);
              setResult(null);
              setError("");
            }}
          >
            <Tab value="form" label="Un kit" />
            <Tab value="excel" label="Desde Excel" />
          </Tabs>
        )}

        {mode === "form" ? (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <TextField
              size="small"
              label="SKU del kit"
              value={kitSku}
              onChange={(e) => setKitSku(e.target.value)}
              disabled={Boolean(kit)}
            />
            <Typography variant="subtitle2">Componentes</Typography>
            {components.map((component, index) => (
              <Box key={index} sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <TextField
                  size="small"
                  label="SKU de Shopify"
                  value={component.sku}
                  onChange={(e) => updateComponent(index, { sku: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  type="number"
                  label="Cantidad"
                  value={component.quantity}
                  onChange={(e) => updateComponent(index, { quantity: e.target.value })}
                  slotProps={{ htmlInput: { min: 1 } }}
                  sx={{ width: 110 }}
                />
                <IconButton
                  aria-label="Quitar componente"
                  onClick={() => setComponents(components.filter((_, i) => i !== index))}
                  disabled={components.length === 1}
                >
                  ×
                </IconButton>
              </Box>
            ))}
            <Box>
              <Button size="small" onClick={() => setComponents([...components, { ...EMPTY_COMPONENT }])}>
                Agregar componente
              </Button>
            </Box>
            <Typography variant="caption" color="textSecondary">
              Al guardar, el kit queda exactamente con estos componentes. Un componente no puede ser otro kit.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Typography variant="body2" color="textSecondary">
              Una fila por componente: <b>{KIT_COLUMNS.join(", ")}</b>. Cada kit del archivo reemplaza completo sus
              componentes; los kits que no vienen no se tocan.
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
              <Button size="small" onClick={downloadKits} disabled={downloading}>
                {downloading ? "Descargando…" : "Descargar kits actuales"}
              </Button>
              <ExcelFileField file={file} onChange={chooseFile} />
              {fileRows && (
                <Typography variant="body2" color="textSecondary">
                  {fileRows.length} {fileRows.length === 1 ? "fila" : "filas"}
                </Typography>
              )}
            </Box>
          </Box>
        )}

        {result && (
          <Alert severity={savedOk ? "success" : "warning"}>
            {result.created} {result.created === 1 ? "kit creado" : "kits creados"}, {result.updated}{" "}
            {result.updated === 1 ? "actualizado" : "actualizados"}.
            {result.errors.length > 0 && (
              <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2 }}>
                {result.errors.map((item) => (
                  <li key={`${item.row}-${item.error}`}>
                    {mode === "excel" ? `Fila ${item.row + 1}: ` : ""}
                    {item.error}
                  </li>
                ))}
              </Box>
            )}
          </Alert>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          {savedOk ? "Cerrar" : "Cancelar"}
        </Button>
        {!savedOk && (
          <Button variant="contained" onClick={submit} disabled={saving || !rowsToSend}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
