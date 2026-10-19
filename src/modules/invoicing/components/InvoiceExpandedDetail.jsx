import { Alert, Box, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { formatDateTime, formatMoney, shopifyProductSearchUrl } from "../../../core/format";
import { invoiceErrorHint, invoiceStatus } from "../invoiceFormat";

// Contenido desplegado de una factura (acordeón de DataTable): motivo si
// falló, datos de la factura, desglose de impuestos y líneas enviadas a Siigo.
export default function InvoiceExpandedDetail({ invoice }) {
  const status = invoiceStatus(invoice.status);
  const hint = invoiceErrorHint(invoice.error_message);
  const failed = invoice.status !== "creada";

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pl: { md: 5 } }}>
      {failed && (
        <Alert severity="error" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {status?.description}
          {invoice.error_message && (
            <Box component="span" sx={{ display: "block", mt: 0.5, fontFamily: "monospace" }}>
              {invoice.error_message}
            </Box>
          )}
          {hint && (
            <Box component="span" sx={{ display: "block", mt: 0.5 }}>
              {hint}
            </Box>
          )}
        </Alert>
      )}

      <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 4, rowGap: 1 }}>
        <Info label="Cliente" value={invoice.customer_name} />
        <Info label="NIT" value={invoice.customer_identification} />
        <Info label="Timbrada ante la DIAN" value={invoice.stamped ? "Sí" : "No"} />
        <Info label="Id en Siigo" value={invoice.siigo_id} />
        <Info label="Último intento" value={formatDateTime(invoice.updated_at)} />
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, alignItems: "flex-start" }}>
        <Table size="small" sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", flex: "2 1 420px" }}>
          <TableHead>
            <TableRow>
              <TableCell>SKU</TableCell>
              <TableCell align="right">Cant.</TableCell>
              <TableCell align="right">Precio sin IVA</TableCell>
              <TableCell align="right">Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {invoice.items.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>Sin líneas.</TableCell>
              </TableRow>
            )}
            {invoice.items.map((item, index) => (
              <TableRow key={`${item.sku}-${index}`}>
                <TableCell>
                  <SkuLink sku={item.sku} />
                </TableCell>
                <TableCell align="right">{item.quantity}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  {formatMoney(item.unit_price)}
                </TableCell>
                <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                  {formatMoney(item.line_total)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Table size="small" sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", flex: "1 1 260px" }}>
          <TableBody>
            <Amount label="Subtotal" value={invoice.subtotal} />
            <Amount label="IVA (19 %)" value={invoice.iva} />
            <Amount label="ReteIVA" value={invoice.reteiva} negative />
            <Amount label="ReteICA" value={invoice.reteica} negative />
            <Amount label="Retefuente" value={invoice.retefuente} negative />
            <Amount label="Total (pago)" value={invoice.total} strong />
            {invoice.siigo_total && <Amount label="Total en Siigo" value={invoice.siigo_total} />}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}

// El SKU abre la búsqueda de productos del admin de Shopify (sin
// `VITE_SHOPIFY_ADMIN_URL`, solo el texto).
function SkuLink({ sku }) {
  const url = shopifyProductSearchUrl(sku);
  if (!url) return sku;
  return (
    <Link href={url} target="_blank" rel="noopener noreferrer" underline="hover" title="Buscar en Shopify">
      {sku}
    </Link>
  );
}

function Amount({ label, value, negative = false, strong = false }) {
  const sx = strong ? { fontWeight: 700 } : undefined;
  return (
    <TableRow>
      <TableCell sx={sx}>{label}</TableCell>
      <TableCell align="right" sx={{ whiteSpace: "nowrap", ...sx }}>
        {negative && value ? "−" : ""}
        {formatMoney(value)}
      </TableCell>
    </TableRow>
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
