import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import MarketplaceLabel from "../../../components/data-display/MarketplaceLabel";
import { SKU_UPLOAD_MARKETPLACES } from "../productFormat";

// Contenido del acordeón de un producto: sus equivalencias por canal y, si es
// kit, sus componentes, con las acciones de edición y borrado. Solo muestra
// los canales que gestiona la pantalla (SKU_UPLOAD_MARKETPLACES).
export default function ProductExpandedDetail({ product, onEditSku, onEditKit, onDeleteSku, onDeleteKit }) {
  const equivalences = product.marketplace_skus.filter((e) => SKU_UPLOAD_MARKETPLACES.includes(e.marketplace));
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2, py: 1 }}>
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
          Equivalencias por marketplace
        </Typography>
        {equivalences.length ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Canal</TableCell>
                <TableCell>SKU del marketplace</TableCell>
                <TableCell>EAN</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {equivalences.map((equivalence) => (
                <TableRow key={equivalence.id}>
                  <TableCell>
                    <MarketplaceLabel value={equivalence.marketplace} />
                  </TableCell>
                  <TableCell>{equivalence.sku}</TableCell>
                  <TableCell>{equivalence.ean || "—"}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    {!product.is_kit && (
                      <Button size="small" onClick={() => onEditSku(product, equivalence)}>
                        Editar
                      </Button>
                    )}
                    <Button size="small" color="error" onClick={() => onDeleteSku(product, equivalence)}>
                      Eliminar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Typography variant="body2" color="textSecondary">
            Sin equivalencias.
          </Typography>
        )}
      </Box>

      {product.is_kit && (
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="subtitle2">Componentes del kit</Typography>
            <Box>
              <Button size="small" onClick={() => onEditKit(product)}>
                Editar kit
              </Button>
              <Button size="small" color="error" onClick={() => onDeleteKit(product)}>
                Eliminar kit
              </Button>
            </Box>
          </Box>
          {product.components.length ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>SKU de Shopify</TableCell>
                  <TableCell align="right">Cantidad</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {product.components.map((component) => (
                  <TableRow key={component.sku}>
                    <TableCell>{component.sku}</TableCell>
                    <TableCell align="right">{component.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Typography variant="body2" color="error">
              Kit sin componentes: sus pedidos no se pueden crear en Shopify.
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
}
