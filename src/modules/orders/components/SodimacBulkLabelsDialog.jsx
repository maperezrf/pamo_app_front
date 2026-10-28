import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from "@mui/material";
import DataTable from "../../../components/tables/DataTable";
import { api } from "../../../core/api/api";
import { shopifyOrderUrl } from "../../../core/format";

const baseColumns = [
  {
    id: "order",
    header: "Pedido",
    accessorFn: (row) => row.order_name || row.shopify_order_id,
    cell: ({ row }) => (
      <Link href={shopifyOrderUrl(row.original.shopify_order_id)} target="_blank" rel="noopener noreferrer">
        {row.original.order_name || row.original.shopify_order_id}
      </Link>
    ),
  },
  { accessorKey: "purchase_order", header: "OC" },
  { id: "platform", header: "Bodega plataforma", accessorFn: (row) => row.platform_location || "—" },
  { id: "shopify", header: "Bodega Shopify", accessorFn: (row) => row.shopify_location || "—" },
];
const blockedColumns = [...baseColumns, { accessorKey: "reason", header: "Novedad" }];
// En las disponibles, lo que dijo el RPA si ya falló antes (revisión manual):
// se pueden reintentar en el lote.
const noteColumn = {
  id: "note",
  header: "Novedad",
  accessorFn: (row) => row.note,
  cell: ({ getValue }) =>
    getValue() ? (
      <Typography variant="body2" color="warning.main">
        {getValue()}
      </Typography>
    ) : (
      "—"
    ),
};

// "Generar guías disponibles": vista previa de las OC de Sodimac que esperan
// guía, separadas en las disponibles (bodega de la plataforma igual a la de
// Shopify) y las que tienen novedad. Las disponibles llevan casilla, todas
// marcadas al abrir; al confirmar, el backend vuelve a calcular la vista y
// manda al RPA, en un lote, solo las marcadas que sigan disponibles.
// Contrato: backend/docs/contracts/API.md ("sodimac/rpa/bulk-labels").
export default function SodimacBulkLabelsDialog({ onClose, onSent }) {
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // OC marcadas para mandar; se marcan todas cada vez que llega la vista.
  const [selected, setSelected] = useState(() => new Set());

  useEffect(() => {
    let active = true;
    api
      .sodimacBulkLabelsPreview()
      .then(({ ok, data }) => {
        if (!active) return;
        if (ok) {
          setPreview(data);
          setSelected(new Set(data.ready.map((item) => item.purchase_order)));
        } else setError(data?.detail || "No se pudo cargar la vista previa.");
      })
      .catch(() => active && setError("No se pudo conectar con el servidor."));
    return () => {
      active = false;
    };
  }, []);

  const send = async () => {
    setSending(true);
    setError("");
    try {
      const { ok, data } = await api.sendSodimacBulkLabels([...selected]);
      if (ok) {
        onSent(data.sent.length);
      } else {
        setError(data?.detail || "El RPA no aceptó las OC.");
        if (data?.ready) {
          setPreview(data);
          setSelected((current) => new Set(data.ready.map((item) => item.purchase_order).filter((oc) => current.has(oc))));
        }
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSending(false);
    }
  };

  const ready = preview?.ready ?? [];
  const blocked = preview?.blocked ?? [];
  const chosen = ready.filter((item) => selected.has(item.purchase_order)).length;

  const readyColumns = useMemo(() => {
    const toggle = (oc) =>
      setSelected((current) => {
        const next = new Set(current);
        if (next.has(oc)) next.delete(oc);
        else next.add(oc);
        return next;
      });
    const all = ready.length > 0 && ready.every((item) => selected.has(item.purchase_order));
    const some = ready.some((item) => selected.has(item.purchase_order));
    return [
      {
        id: "select",
        enableSorting: false,
        header: () => (
          <Checkbox
            size="small"
            checked={all}
            indeterminate={some && !all}
            disabled={sending || !ready.length}
            onChange={() => setSelected(all ? new Set() : new Set(ready.map((item) => item.purchase_order)))}
            inputProps={{ "aria-label": "Marcar todas" }}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            size="small"
            checked={selected.has(row.original.purchase_order)}
            disabled={sending}
            onChange={() => toggle(row.original.purchase_order)}
            inputProps={{ "aria-label": `Enviar OC ${row.original.purchase_order}` }}
          />
        ),
      },
      ...baseColumns,
      noteColumn,
    ];
  }, [ready, selected, sending]);

  return (
    <Dialog open onClose={sending ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>Generar guías disponibles</DialogTitle>
      <DialogContent dividers>
        {!preview && !error && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {preview && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" gutterBottom>
                Órdenes disponibles para generar guía ({chosen} de {ready.length} marcadas)
              </Typography>
              <DataTable
                columns={readyColumns}
                data={ready}
                searchable={false}
                getRowId={(row) => row.purchase_order}
                emptyMessage="No hay OC disponibles."
              />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle2" gutterBottom>
                Órdenes con novedad ({blocked.length})
              </Typography>
              <DataTable
                columns={blockedColumns}
                data={blocked}
                searchable={false}
                getRowId={(row) => row.purchase_order}
                emptyMessage="Ninguna OC con novedad."
              />
            </Box>
          </Box>
        )}
        {error && (
          <Alert severity="error" sx={{ mt: preview ? 2 : 0 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={send} disabled={sending || !chosen}>
          {sending ? "Enviando…" : `Enviar ${chosen} al RPA`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
