import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Link,
  Typography,
} from "@mui/material";
import DataTable from "../../../components/tables/DataTable";
import MarketplaceLabel from "../../../components/data-display/MarketplaceLabel";
import StatusChip from "../../../components/data-display/StatusChip";
import { api } from "../../../core/api/api";
import { shopifyOrderUrl } from "../../../core/format";

const CHANNEL_LABEL = { api: "Envía", email: "Correo", whatsapp: "WhatsApp" };

const orderColumn = {
  id: "order",
  header: "Pedido",
  accessorFn: (row) => row.order_name || row.shopify_order_id,
  cell: ({ row }) => (
    <Link href={shopifyOrderUrl(row.original.shopify_order_id)} target="_blank" rel="noopener noreferrer">
      {row.original.order_name || row.original.shopify_order_id}
    </Link>
  ),
};
const channelColumn = {
  id: "marketplace",
  header: "Canal",
  accessorKey: "marketplace",
  cell: ({ getValue }) => <MarketplaceLabel value={getValue()} />,
};
const readyColumns = [orderColumn, channelColumn, { accessorKey: "label", header: "Guía" }];
const blockedColumns = [orderColumn, channelColumn, { accessorKey: "reason", header: "Novedad" }];

// "Notificar bodegas": pedidos que esperan aviso agrupados por bodega, con
// los listos y los que tienen novedad; cada bodega se avisa por separado en
// un solo mensaje con todos sus pedidos listos (el backend recalcula al
// enviar). Contrato: backend/docs/contracts/API.md ("dispatch/bulk-notify").
export default function BulkNotifyDialog({ onClose, onNotified }) {
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(null);
  const [messages, setMessages] = useState({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const { ok, data } = await api.bulkNotifyPreview();
      if (ok) setPreview(data);
      else setError(data?.detail || "No se pudo cargar la vista previa.");
    } catch {
      setError("No se pudo conectar con el servidor.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const notify = async (location) => {
    if (!window.confirm(`Se avisará a ${location.name} de ${location.ready.length} pedido(s). ¿Continuar?`)) return;
    setSending(location.id);
    try {
      const { ok, data } = await api.bulkNotifyLocation(location.id);
      let message;
      if (ok) {
        const parts = [`${data.notified.length} avisado(s)`];
        if (data.failed.length) parts.push(`con error: ${data.failed.join(", ")}`);
        if (data.waiting.length) parts.push(`sin guía: ${data.waiting.map((item) => item.order_name).join(", ")}`);
        message = { severity: data.failed.length || data.waiting.length ? "warning" : "success", text: parts.join(" · ") };
        onNotified();
      } else {
        message = { severity: "error", text: data?.detail || "No se pudo avisar a la bodega." };
      }
      setMessages((current) => ({ ...current, [location.id]: message }));
      await load();
    } catch {
      setMessages((current) => ({ ...current, [location.id]: { severity: "error", text: "No se pudo conectar con el servidor." } }));
    } finally {
      setSending(null);
    }
  };

  const locations = preview?.locations ?? [];
  const unassigned = preview?.unassigned ?? [];

  return (
    <Dialog open onClose={sending ? undefined : onClose} fullWidth maxWidth="lg">
      <DialogTitle>Notificar bodegas</DialogTitle>
      <DialogContent dividers>
        {!preview && !error && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}
        {error && <Alert severity="error">{error}</Alert>}
        {preview && !locations.length && !unassigned.length && (
          <Typography color="textSecondary">No hay pedidos esperando aviso.</Typography>
        )}
        {locations.map((location, index) => (
          <Box key={location.id} sx={{ mb: 3 }}>
            {index > 0 && <Divider sx={{ mb: 2 }} />}
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1 }}>
              <Typography variant="h6" component="h2">
                {location.name}
              </Typography>
              <StatusChip
                label={location.requires_label ? "Exige guía" : "No exige guía"}
                tone={location.requires_label ? "neutral" : "success"}
              />
              <Typography variant="body2" color="textSecondary">
                {location.channels.length
                  ? `Aviso por ${location.channels.map((channel) => CHANNEL_LABEL[channel] ?? channel).join(", ")}`
                  : "Sin canales de aviso"}
              </Typography>
              <Button
                size="small"
                variant="contained"
                sx={{ ml: { sm: "auto" } }}
                disabled={!!sending || !location.ready.length}
                onClick={() => notify(location)}
              >
                {sending === location.id ? "Avisando…" : `Notificar ${location.ready.length} a ${location.name}`}
              </Button>
            </Box>
            {messages[location.id] && (
              <Alert severity={messages[location.id].severity} sx={{ mb: 1 }}>
                {messages[location.id].text}
              </Alert>
            )}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Listos para avisar ({location.ready.length})
                </Typography>
                <DataTable
                  columns={readyColumns}
                  data={location.ready}
                  searchable={false}
                  getRowId={(row) => `${row.shopify_order_id}-${row.dispatch_id ?? ""}`}
                  emptyMessage="Ninguno listo."
                />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Con novedad ({location.blocked.length})
                </Typography>
                <DataTable
                  columns={blockedColumns}
                  data={location.blocked}
                  searchable={false}
                  getRowId={(row) => `${row.shopify_order_id}-${row.dispatch_id ?? ""}`}
                  emptyMessage="Ninguno con novedad."
                />
              </Box>
            </Box>
          </Box>
        ))}
        {unassigned.length > 0 && (
          <Box>
            {locations.length > 0 && <Divider sx={{ mb: 2 }} />}
            <Typography variant="h6" component="h2" gutterBottom>
              Sin bodega ({unassigned.length})
            </Typography>
            <DataTable
              columns={blockedColumns}
              data={unassigned}
              searchable={false}
              getRowId={(row) => `${row.shopify_order_id}-${row.dispatch_id ?? ""}`}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={!!sending}>
          Cerrar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
