import { Alert, Box, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import StatusChip from "../../../components/data-display/StatusChip";
import DispatchActions from "./DispatchActions";
import {
  dispatchStatus,
  formatDateTime,
  formatMoney,
  notificationChannelLabel,
  notificationStatus,
  shopifyProductSearchUrl,
  warehouse,
} from "../orderFormat";

// Contenido desplegado de una fila de pedidos (acordeón de DataTable).
// `order.kind`: "shopify" (orders) o "not_created" (orders_not_created).
export default function OrderExpandedDetail({ order, onChanged }) {
  const isShopify = order.kind === "shopify";
  const customer = order.customer ?? {};
  const bodega = warehouse(order.fulfillment);
  const address = [customer.address, customer.city, customer.region].filter(Boolean).join(", ");
  const identification = [customer.identification_type, customer.identification].filter(Boolean).join(" ");

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pl: { md: 5 } }}>
      {!isShopify && order.error && (
        <Alert severity="error" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {order.error}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 1 }}>
        <Info label="Identificación" value={identification} />
        <Info label="Correo" value={customer.email} />
        <Info label="Teléfono" value={customer.phone} />
        <Info label="Dirección" value={address} />
        {bodega?.detail && <Info label="Bodega" value={bodega.detail} />}
        {order.cancelled_at && <Info label="Cancelado" value={formatDateTime(order.cancelled_at)} />}
        {!isShopify && order.shipment_id && <Info label="Envío" value={order.shipment_id} />}
        {!isShopify && <Info label="Última actualización" value={formatDateTime(order.updated_at)} />}
      </Box>

      {isShopify && (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper", p: 1.5 }}>
          {order.dispatch ? (
            <DispatchSummary dispatch={order.dispatch} />
          ) : (
            <Typography variant="body2" color="textSecondary">
              Sin despacho todavía: "Notificar a proveedor" asigna la bodega y avisa.
            </Typography>
          )}
          <DispatchActions order={order} onChanged={onChanged} />
        </Box>
      )}

      <Table size="small" sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
        <TableHead>
          <TableRow>
            <TableCell>{isShopify ? "Producto" : "SKU del marketplace"}</TableCell>
            <TableCell align="right">Cant.</TableCell>
            <TableCell align="right">Precio unitario</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {order.items.map((item, index) => (
            <TableRow key={`${item.sku}-${index}`}>
              <TableCell>
                <ProductName item={item} linkToShopify={isShopify} />
              </TableCell>
              <TableCell align="right">{item.quantity}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {formatMoney(item.unit_price, order.currency)}
              </TableCell>
              <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                {formatMoney(item.line_total, order.currency)}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell colSpan={3} align="right" sx={{ fontWeight: 700, borderBottom: 0 }}>
              Total
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap", borderBottom: 0 }}>
              {formatMoney(order.total, order.currency)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </Box>
  );
}

// El SKU de una línea de Shopify abre la búsqueda del producto en el admin.
// El de un pedido no creado es del marketplace, por eso no enlaza.
function ProductName({ item, linkToShopify }) {
  const url = linkToShopify ? shopifyProductSearchUrl(item.sku) : null;
  const sku = item.sku || "—";
  return (
    <>
      {url ? (
        <Link href={url} target="_blank" rel="noopener noreferrer" variant="body2" fontWeight={600} underline="hover">
          {sku}
        </Link>
      ) : (
        <Typography variant="body2" fontWeight={600} component="span">
          {sku}
        </Typography>
      )}
      {item.name && (
        <Typography variant="caption" color="textSecondary" component="span" sx={{ display: "block" }}>
          {item.name}
        </Typography>
      )}
    </>
  );
}

// Despacho a la bodega: a quién le toca, en qué va y cómo se le avisó.
function DispatchSummary({ dispatch }) {
  const status = dispatchStatus(dispatch.status);
  return (
    <Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          Despacho{dispatch.location_name ? `: ${dispatch.location_name}` : ""}
        </Typography>
        {status && <StatusChip {...status} />}
        {dispatch.tracking_number && (
          <Typography variant="body2" color="textSecondary">
            Guía {dispatch.tracking_number}
            {dispatch.label_source === "envia" && ` · generada en Envía (${dispatch.label_carrier} ${dispatch.label_service})`}
            {dispatch.label_source === "canal" && " · del canal"}
          </Typography>
        )}
      </Box>
      {dispatch.note && (
        <Typography variant="body2" color="textSecondary" sx={{ mt: 0.75 }}>
          {dispatch.note}
        </Typography>
      )}
      {dispatch.notifications.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
          {dispatch.notifications.map((notification) => {
            const sent = notificationStatus(notification.status);
            return (
              <Box key={notification.channel} sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" sx={{ minWidth: 96 }}>
                  {notificationChannelLabel(notification.channel)}
                </Typography>
                {sent && <StatusChip {...sent} title={notification.error || undefined} />}
                <Typography variant="caption" color="textSecondary" sx={{ wordBreak: "break-word" }}>
                  {notification.error ||
                    [
                      notification.recipient,
                      notification.channel === "api" && notification.external_id ? `orden Envía ${notification.external_id}` : "",
                      formatDateTime(notification.sent_at),
                    ]
                      .filter((v) => v && v !== "—")
                      .join(" · ")}
                </Typography>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

function Info({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="textSecondary" component="div">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
        {value || "—"}
      </Typography>
    </Box>
  );
}
