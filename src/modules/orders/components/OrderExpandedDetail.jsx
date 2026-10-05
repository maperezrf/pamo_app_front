import { Alert, Box, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import {
  formatDateTime,
  formatMoney,
  shopifyProductSearchUrl,
  warehouse,
} from "../orderFormat";

// Contenido desplegado de una fila de pedidos (acordeón de DataTable).
// `order.kind`: "shopify" (orders) o "not_created" (orders_not_created).
export default function OrderExpandedDetail({ order }) {
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
