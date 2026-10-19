import { useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";
import { api } from "../../../core/api/api";
import { marketplaceLabel } from "../../../components/data-display/MarketplaceLabel";
import { errorMessage } from "../productFormat";

// Confirmación de borrado. `target`: {type: "delete-sku", product,
// equivalence} borra solo esa equivalencia (el producto queda);
// {type: "delete-kit", product} borra el kit con sus componentes y
// equivalencias (los productos componentes quedan). No se puede deshacer.
export default function DeleteDialog({ target, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const { product, equivalence } = target;
  const isKit = target.type === "delete-kit";

  const confirm = async () => {
    setDeleting(true);
    setError("");
    try {
      const { ok, status, data } = isKit
        ? await api.deleteKit(product.id)
        : await api.deleteMarketplaceSku(equivalence.id);
      // 404: ya no existía (otra persona lo borró); el resultado es el mismo.
      if (ok || status === 404) onDeleted();
      else if (status === 403) setError("No tienes permiso para eliminar.");
      else setError(errorMessage(data, "No se pudo eliminar."));
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open onClose={deleting ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{isKit ? `Eliminar kit ${product.sku}` : "Eliminar equivalencia"}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {isKit ? (
          <Typography variant="body2">
            Se borran el kit, sus {product.components.length} componentes y sus {product.marketplace_skus.length}{" "}
            equivalencias de marketplace. Los productos que lo componen no se tocan. Los pedidos que traigan este SKU
            ya no se traducirán.
          </Typography>
        ) : (
          <Typography variant="body2">
            Se borra el SKU <b>{equivalence.sku}</b> de {marketplaceLabel(equivalence.marketplace)}, que apunta a{" "}
            <b>{product.sku}</b>. El producto se conserva. Los pedidos que traigan este SKU llegarán a Shopify sin
            traducir.
          </Typography>
        )}
        <Typography variant="body2" color="error">
          No se puede deshacer.
        </Typography>
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancelar
        </Button>
        <Button variant="contained" color="error" onClick={confirm} disabled={deleting}>
          {deleting ? "Eliminando…" : "Eliminar"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
