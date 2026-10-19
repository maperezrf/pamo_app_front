import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  MenuItem,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../core/api/api";
import { downloadSheet, readSheetRows } from "../../../core/excel";
import MarketplaceLabel from "../../../components/data-display/MarketplaceLabel";
import StatusChip from "../../../components/data-display/StatusChip";
import {
  errorMessage,
  isFinalStatus,
  RESULT_CODES,
  SKU_UPLOAD_COLUMNS,
  SKU_UPLOAD_MARKETPLACES,
  SKU_UPLOAD_MAX_ROWS,
  uploadStatus,
} from "../productFormat";
import ExcelFileField from "./ExcelFileField";

const POLL_MS = 2500;
const EMPTY_ROW = { sku_pamo: "", sku_marketplace: "", ean: "" };

// Carga de SKU de UN marketplace (`POST /api/products/sku-uploads/`): desde
// Excel o una sola fila. El backend la procesa en segundo plano y valida cada
// `sku_pamo` contra Shopify; acá se hace polling del detalle hasta un estado
// final y se ofrece el reporte por fila. `initial` ({marketplace, row})
// abre el modo fila para editar una equivalencia existente.
export default function SkuUploadDialog({ initial, onClose, onFinished }) {
  const [marketplace, setMarketplace] = useState(initial?.marketplace ?? SKU_UPLOAD_MARKETPLACES[0]);
  const [mode, setMode] = useState(initial ? "single" : "excel");
  const [file, setFile] = useState(null);
  const [fileRows, setFileRows] = useState(null);
  const [single, setSingle] = useState({ ...EMPTY_ROW, ...initial?.row });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadId, setUploadId] = useState(null);
  const [upload, setUpload] = useState(null);

  // Editar: canal y SKU del marketplace fijos.
  const editing = Boolean(initial);
  const finished = isFinalStatus(upload?.status);
  const running = Boolean(uploadId) && !finished;

  // Polling del detalle hasta un estado final; se corta al desmontar.
  useEffect(() => {
    if (!uploadId) return undefined;
    let timer;
    let stopped = false;
    const poll = () => {
      api
        .getSkuUpload(uploadId)
        .then(({ ok, data }) => {
          if (stopped) return;
          if (!ok) {
            setError("No se pudo consultar el estado de la carga.");
            return;
          }
          setUpload(data);
          if (isFinalStatus(data.status)) onFinished?.();
          else timer = setTimeout(poll, POLL_MS);
        })
        .catch(() => {
          if (!stopped) timer = setTimeout(poll, POLL_MS);
        });
    };
    poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [uploadId, onFinished]);

  const chooseFile = async (selected) => {
    setFile(selected);
    setFileRows(null);
    setError("");
    if (!selected) return;
    try {
      const rows = await readSheetRows(selected);
      const missing = ["sku_pamo", "sku_marketplace"].filter((column) => rows.length && !(column in rows[0]));
      if (!rows.length) setError("El archivo no tiene filas.");
      else if (missing.length) setError(`Falta la columna ${missing.join(", ")}. Descarga la plantilla.`);
      else if (rows.length > SKU_UPLOAD_MAX_ROWS) setError(`Máximo ${SKU_UPLOAD_MAX_ROWS} filas por carga.`);
      else setFileRows(rows);
    } catch {
      setError("No se pudo leer el archivo. Debe ser un Excel (.xlsx, .xls) o CSV.");
    }
  };

  const rowsToSend = () => {
    if (mode === "excel") return fileRows;
    const row = { sku_pamo: single.sku_pamo.trim(), sku_marketplace: single.sku_marketplace.trim() };
    if (single.ean.trim()) row.ean = single.ean.trim();
    return row.sku_pamo && row.sku_marketplace ? [row] : null;
  };

  const submit = async () => {
    const rows = rowsToSend();
    if (!rows) return;
    setSubmitting(true);
    setError("");
    try {
      const { ok, status, data } = await api.createSkuUpload(marketplace, rows);
      if (ok) setUploadId(data.id);
      else if (status === 403) setError("No tienes permiso para cargar SKU.");
      else setError(errorMessage(data, "No se pudo iniciar la carga."));
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadReport = () => {
    const rows = upload?.rows ?? [];
    const columns = [...new Set([...SKU_UPLOAD_COLUMNS, ...rows.flatMap(Object.keys)])];
    downloadSheet(`reporte_sku_${upload.marketplace}_${upload.id}.xlsx`, columns, rows);
  };

  const canSubmit = !uploadId && !submitting && Boolean(rowsToSend());

  return (
    <Dialog open onClose={running || submitting ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>{editing ? "Editar equivalencia" : "Cargar SKU de marketplace"}</DialogTitle>
      <DialogContent dividers sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {!uploadId && (
          <>
            <TextField
              select
              size="small"
              label="Marketplace"
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              disabled={editing}
            >
              {SKU_UPLOAD_MARKETPLACES.map((value) => (
                <MenuItem key={value} value={value}>
                  <MarketplaceLabel value={value} />
                </MenuItem>
              ))}
            </TextField>

            {!initial && (
              <Tabs value={mode} onChange={(_, value) => setMode(value)}>
                <Tab value="excel" label="Desde Excel" />
                <Tab value="single" label="Una fila" />
              </Tabs>
            )}

            {mode === "excel" ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <Typography variant="body2" color="textSecondary">
                  Columnas: <b>sku_pamo</b>, <b>sku_marketplace</b> y <b>ean</b> (opcional). Las demás columnas se
                  conservan en el reporte. Máximo {SKU_UPLOAD_MAX_ROWS} filas.
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
                  <Button size="small" onClick={() => downloadSheet("plantilla_sku.xlsx", SKU_UPLOAD_COLUMNS, [])}>
                    Descargar plantilla
                  </Button>
                  <ExcelFileField file={file} onChange={chooseFile} />
                  {fileRows && (
                    <Typography variant="body2" color="textSecondary">
                      {fileRows.length} {fileRows.length === 1 ? "fila" : "filas"}
                    </Typography>
                  )}
                </Box>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <TextField
                  size="small"
                  label="SKU de Pamo (Shopify)"
                  value={single.sku_pamo}
                  onChange={(e) => setSingle({ ...single, sku_pamo: e.target.value })}
                />
                <TextField
                  size="small"
                  label="SKU del marketplace"
                  value={single.sku_marketplace}
                  onChange={(e) => setSingle({ ...single, sku_marketplace: e.target.value })}
                  disabled={editing}
                />
                <TextField
                  size="small"
                  label="EAN (opcional)"
                  helperText="Vacío no borra el EAN que ya existe."
                  value={single.ean}
                  onChange={(e) => setSingle({ ...single, ean: e.target.value })}
                />
              </Box>
            )}
            <Typography variant="caption" color="textSecondary">
              Cada SKU de Pamo se valida contra Shopify. Si el SKU del marketplace ya apuntaba a otro producto, se
              reasigna. Los kits se cargan aparte.
            </Typography>
          </>
        )}

        {uploadId && <UploadProgress upload={upload} single={mode === "single"} />}

        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        {finished && upload?.rows?.length > 0 && <Button onClick={downloadReport}>Descargar reporte</Button>}
        <Button onClick={onClose} disabled={running || submitting}>
          {uploadId ? "Cerrar" : "Cancelar"}
        </Button>
        {!uploadId && (
          <Button variant="contained" onClick={submit} disabled={!canSubmit}>
            {submitting ? "Enviando…" : "Cargar"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function UploadProgress({ upload, single }) {
  if (!upload) return <LinearProgress />;
  const status = uploadStatus(upload.status);
  const finished = isFinalStatus(upload.status);
  const byCode = upload.summary?.por_codigo ?? {};
  const singleResult = single ? upload.rows?.[0] : null;

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <StatusChip label={status.label} tone={status.tone} />
        <MarketplaceLabel value={upload.marketplace} />
      </Box>
      {!finished && (
        <>
          <LinearProgress
            variant={upload.progress_percent ? "determinate" : "indeterminate"}
            value={upload.progress_percent ?? 0}
          />
          {upload.current_step && (
            <Typography variant="body2" color="textSecondary">
              {upload.current_step}
            </Typography>
          )}
        </>
      )}
      {upload.error_message && <Alert severity="error">{upload.error_message}</Alert>}
      {singleResult ? (
        <Alert severity={singleResult.resultado_codigo === "ok" ? "success" : singleResult.resultado_codigo === "error" ? "error" : "warning"}>
          {singleResult.resultado}
        </Alert>
      ) : (
        finished &&
        upload.summary && (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
            <Typography variant="body2">{upload.summary.total} filas:</Typography>
            {RESULT_CODES.map((code) => (
              <StatusChip key={code.value} label={`${code.label}: ${byCode[code.value] ?? 0}`} tone={code.tone} />
            ))}
          </Box>
        )
      )}
      {finished && !single && (
        <Typography variant="caption" color="textSecondary">
          El reporte trae cada fila con su resultado.
        </Typography>
      )}
    </Box>
  );
}
