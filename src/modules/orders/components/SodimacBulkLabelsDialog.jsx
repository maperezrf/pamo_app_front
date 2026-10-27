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

// "Generar guías disponibles": vista previa de las OC de Sodimac que esperan
// guía, separadas en las que se mandan al RPA (bodega de la plataforma igual
// a la de Shopify) y las que tienen novedad; al confirmar, el backend vuelve
// a calcularla y manda solo las disponibles en un lote.
// Contrato: backend/docs/contracts/API.md ("sodimac/rpa/bulk-labels").
export default function SodimacBulkLabelsDialog({ onClose, onSent }) {
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api
      .sodimacBulkLabelsPreview()
      .then(({ ok, data }) => {
        if (!active) return;
        if (ok) setPreview(data);
        else setError(data?.detail || "No se pudo cargar la vista previa.");
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
      const { ok, data } = await api.sendSodimacBulkLabels();
      if (ok) {
        onSent(data.sent.length);
      } else {
        setError(data?.detail || "El RPA no aceptó las OC.");
        if (data?.ready) setPreview(data);
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSending(false);
    }
  };

  const ready = preview?.ready ?? [];
  const blocked = preview?.blocked ?? [];

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
                Órdenes disponibles para generar guía ({ready.length})
              </Typography>
              <DataTable
                columns={baseColumns}
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
        <Button variant="contained" onClick={send} disabled={sending || !ready.length}>
          {sending ? "Enviando…" : `Enviar ${ready.length} al RPA`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
