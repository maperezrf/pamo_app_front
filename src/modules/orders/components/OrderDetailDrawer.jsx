import {
  Alert,
  Box,
  Divider,
  Drawer,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import StatusChip from "../../../components/data-display/StatusChip";
import MarketplaceLabel from "./MarketplaceLabel";
import {
  customerName,
  financialStatus,
  formatDateTime,
  formatMoney,
  notCreatedStatusLabel,
  shopifyFulfillmentStatus,
  warehouse,
} from "../orderFormat";

// Detalle de un pedido de cualquiera de las dos listas del contrato:
// `order.kind` es "shopify" (orders) o "not_created" (orders_not_created).
export default function OrderDetailDrawer({ order, onClose }) {
  return (
    <Drawer anchor="right" open={Boolean(order)} onClose={onClose}>
      <Box sx={{ width: { xs: "100vw", sm: 460 }, p: 3 }}>{order && <OrderDetail order={order} onClose={onClose} />}</Box>
    </Drawer>
  );
}

function OrderDetail({ order, onClose }) {
  const isShopify = order.kind === "shopify";
  const title = isShopify ? order.shopify_order_name : `Pedido ${order.marketplace_order_number}`;
  const numbers = isShopify ? order.marketplace_order_numbers : [];
  const payment = isShopify && financialStatus(order.financial_status);
  const shipping = isShopify && shopifyFulfillmentStatus(order.fulfillment_status);
  const bodega = warehouse(order.fulfillment);

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box>
          <Typography variant="h6" component="h2" fontWeight={700}>
            {title}
          </Typography>
          <Typography variant="body2" color="textSecondary" component="div" sx={{ mt: 0.5 }}>
            <MarketplaceLabel value={order.marketplace} />
            {numbers.length > 0 && ` · ${numbers.join(", ")}`}
          </Typography>
        </Box>
        <IconButton aria-label="Cerrar" onClick={onClose} size="small">
          ✕
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
        {order.cancelled_at && <StatusChip label="Cancelado" tone="error" />}
        {payment && <StatusChip {...payment} />}
        {shipping && <StatusChip {...shipping} />}
        {!isShopify && <StatusChip label={notCreatedStatusLabel(order.status)} tone="error" />}
      </Box>

      {!isShopify && order.error && (
        <Alert severity="error" sx={{ mt: 2, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {order.error}
        </Alert>
      )}

      <Section title="Fechas">
        <Field label={isShopify ? "Creado en Shopify" : "Llegó al sistema"} value={formatDateTime(order.created_at)} />
        {order.cancelled_at && <Field label="Cancelado" value={formatDateTime(order.cancelled_at)} />}
        {!isShopify && <Field label="Última actualización" value={formatDateTime(order.updated_at)} />}
        {!isShopify && order.shipment_id && <Field label="Envío" value={order.shipment_id} />}
      </Section>

      <Section title="Cliente">
        <Field label="Nombre" value={customerName(order.customer)} />
        <Field
          label="Identificación"
          value={[order.customer?.identification_type, order.customer?.identification].filter(Boolean).join(" ")}
        />
        <Field label="Correo" value={order.customer?.email} />
        <Field label="Teléfono" value={order.customer?.phone} />
        <Field
          label="Dirección"
          value={[order.customer?.address, order.customer?.city, order.customer?.region].filter(Boolean).join(", ")}
        />
      </Section>

      <Section title="Bodega de despacho">
        {bodega ? (
          <>
            <StatusChip label={bodega.label} tone={bodega.tone} />
            {bodega.detail && (
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                {bodega.detail}
              </Typography>
            )}
          </>
        ) : (
          <Typography variant="body2" color="textSecondary">
            Sin evaluar
          </Typography>
        )}
      </Section>

      <Section title="Ítems">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ pl: 0 }}>SKU</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right" sx={{ pr: 0 }}>
                Total
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {order.items.map((item, index) => (
              <TableRow key={`${item.sku}-${index}`}>
                <TableCell sx={{ pl: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {item.sku || "—"}
                  </Typography>
                  {item.name && (
                    <Typography variant="caption" color="textSecondary">
                      {item.name}
                    </Typography>
                  )}
                </TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right" sx={{ pr: 0, whiteSpace: "nowrap" }}>
                  {formatMoney(item.line_total, order.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1.5 }}>
          <Typography fontWeight={700}>Total</Typography>
          <Typography fontWeight={700}>{formatMoney(order.total, order.currency)}</Typography>
        </Box>
      </Section>
    </>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }} />
      <Typography variant="overline" color="textSecondary" component="h3" sx={{ display: "block", mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function Field({ label, value }) {
  return (
    <Box sx={{ display: "flex", gap: 2, py: 0.5 }}>
      <Typography variant="body2" color="textSecondary" sx={{ width: 140, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}
