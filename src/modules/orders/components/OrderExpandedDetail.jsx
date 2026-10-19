import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { api } from "../../../core/api/api";
import FileField from "./FileField";
import StatusChip from "../../../components/data-display/StatusChip";
import DispatchActions from "./DispatchActions";
import {
  channelLabelStatus,
  dispatchStatus,
  formatDateTime,
  formatMoney,
  fulfillmentOrderStatus,
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

      {isShopify && order.channel_label && <ChannelLabel order={order} onChanged={onChanged} />}

      {isShopify && (order.fulfillment_orders ?? []).length > 0 ? (
        <ShopifyWarehouses order={order} onChanged={onChanged} />
      ) : (
        <>
          {isShopify &&
            ((order.dispatches ?? []).length > 0 ? (
              order.dispatches.map((dispatch) => (
                <Card key={dispatch.id}>
                  <DispatchBlock order={order} dispatch={dispatch} onChanged={onChanged} />
                </Card>
              ))
            ) : (
              <Card>
                <DispatchBlock order={order} dispatch={null} onChanged={onChanged} />
              </Card>
            ))}
          <ProductTable
            items={order.items}
            currency={order.currency}
            linkToShopify={isShopify}
            heading={isShopify ? "Producto" : "SKU del marketplace"}
            total={order.total}
          />
        </>
      )}
    </Box>
  );
}

// Pedido de Shopify agrupado por las bodegas desde donde sale según Shopify
// (`fulfillment_orders`), cada una con sus productos. Cada despacho de este
// sistema (`dispatches`: uno por pedido, o uno por bodega si Shopify repartió
// un pedido web) y sus botones van en la bodega que coincide con la suya: así
// nunca se avisa a una bodega con productos que no le tocan. Sin despachos y
// con una sola bodega, los botones van en ella; un despacho sin bodega de
// Shopify que coincida va en un recuadro aparte.
function ShopifyWarehouses({ order, onChanged }) {
  const fulfillmentOrders = order.fulfillment_orders;
  const dispatches = order.dispatches ?? [];
  const cardOf = (dispatch) =>
    fulfillmentOrders.findIndex((fo) => dispatch.location_id && fo.location_id === dispatch.location_id);
  const hosted = new Set(dispatches.map(cardOf).filter((index) => index !== -1));
  const unhosted = dispatches.filter((dispatch) => cardOf(dispatch) === -1);
  const emptyHost = dispatches.length === 0 && fulfillmentOrders.length === 1 ? 0 : -1;
  const leftovers = itemsOutsideWarehouses(order.items, fulfillmentOrders);

  return (
    <>
      {dispatches.length === 0 && emptyHost === -1 && (
        <Card>
          <DispatchBlock order={order} dispatch={null} onChanged={onChanged} />
        </Card>
      )}
      {unhosted.map((dispatch) => (
        <Card key={dispatch.id}>
          <Alert severity="warning" sx={{ mb: 1.25 }}>
            {dispatch.location_name
              ? `Nuestra bodega (${dispatch.location_name}) no coincide con ninguna de las de Shopify.`
              : "El despacho no tiene bodega todavía."}
          </Alert>
          <DispatchBlock order={order} dispatch={dispatch} onChanged={onChanged} />
        </Card>
      ))}
      {fulfillmentOrders.map((fo, index) => {
        const dispatch = dispatches.find((d) => cardOf(d) === index);
        return (
          <WarehouseCard key={fo.id} fo={fo} order={order}>
            {dispatch ? (
              <DispatchBlock order={order} dispatch={dispatch} onChanged={onChanged} />
            ) : index === emptyHost ? (
              <DispatchBlock order={order} dispatch={null} onChanged={onChanged} />
            ) : (
              hosted.size > 0 && (
                <Typography variant="body2" color="textSecondary">
                  Sin despacho para esta bodega.
                </Typography>
              )
            )}
          </WarehouseCard>
        );
      })}
      {leftovers.length > 0 && (
        <Card>
          <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
            Sin bodega en Shopify
          </Typography>
          <ProductTable items={leftovers} currency={order.currency} linkToShopify />
        </Card>
      )}
      <Typography variant="body2" fontWeight={700} sx={{ textAlign: "right", pr: 2 }}>
        Total {formatMoney(order.total, order.currency)}
      </Typography>
    </>
  );
}

// Una bodega de Shopify: nombre, estado, guía de Shopify y sus productos
// (con el precio de la línea del pedido del mismo SKU).
function WarehouseCard({ fo, order, children }) {
  const status = fulfillmentOrderStatus(fo.status);
  const { tracking } = fo;
  const items = fo.items.map((item) => withPrice(item, order.items));
  return (
    <Card>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1, mb: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          Bodega: {fo.location_name || "Sin bodega"}
        </Typography>
        {status && <StatusChip {...status} />}
        {tracking.number && (
          <Typography variant="body2" color="textSecondary">
            Guía en Shopify{" "}
            {tracking.url ? (
              <Link href={tracking.url} target="_blank" rel="noopener noreferrer" underline="hover">
                {tracking.number}
              </Link>
            ) : (
              tracking.number
            )}
            {tracking.company && tracking.company !== "Other" && ` · ${tracking.company}`}
          </Typography>
        )}
      </Box>
      <ProductTable items={items} currency={order.currency} linkToShopify />
      {children && <Box sx={{ mt: 1.25 }}>{children}</Box>}
    </Card>
  );
}

// Estado de un despacho con sus botones; sin despacho, el mensaje de siempre.
function DispatchBlock({ order, dispatch, onChanged }) {
  return (
    <>
      {dispatch ? (
        <DispatchSummary dispatch={dispatch} shopifyOrderId={order.shopify_order_id} />
      ) : (
        <Typography variant="body2" color="textSecondary">
          Sin despacho todavía: "Notificar a proveedor" asigna la bodega y avisa.
        </Typography>
      )}
      <DispatchActions order={order} dispatch={dispatch} onChanged={onChanged} />
    </>
  );
}

function Card({ children }) {
  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper", p: 1.5 }}>
      {children}
    </Box>
  );
}

// Producto de una bodega con el precio unitario de la línea del pedido del
// mismo SKU (Shopify no lo trae en el fulfillment order).
function withPrice(item, orderItems) {
  const line = orderItems.find((orderItem) => orderItem.sku === item.sku);
  const unit = line?.unit_price ?? null;
  const total = unit == null ? null : (Number(unit) * item.quantity).toFixed(2);
  return { ...item, name: item.name || line?.name || "", unit_price: unit, line_total: total };
}

// Líneas del pedido (o la parte de ellas) que no están en ninguna bodega de
// Shopify, p. ej. productos sin envío. Se comparan cantidades por SKU.
function itemsOutsideWarehouses(orderItems, fulfillmentOrders) {
  const assigned = {};
  fulfillmentOrders.forEach((fo) =>
    fo.items.forEach((item) => {
      assigned[item.sku] = (assigned[item.sku] ?? 0) + item.quantity;
    }),
  );
  const result = [];
  orderItems.forEach((item) => {
    const covered = Math.min(assigned[item.sku] ?? 0, item.quantity);
    assigned[item.sku] = (assigned[item.sku] ?? 0) - covered;
    const missing = item.quantity - covered;
    if (missing > 0) result.push(withPrice({ sku: item.sku, name: item.name, quantity: missing }, orderItems));
  });
  return result;
}

function ProductTable({ items, currency, linkToShopify, heading = "Producto", total }) {
  return (
    <Table size="small" sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider" }}>
      <TableHead>
        <TableRow>
          <TableCell>{heading}</TableCell>
          <TableCell align="right">Cant.</TableCell>
          <TableCell align="right">Precio unitario</TableCell>
          <TableCell align="right">Total</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={`${item.sku}-${index}`}>
            <TableCell>
              <ProductName item={item} linkToShopify={linkToShopify} />
            </TableCell>
            <TableCell align="right">{item.quantity}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
              {formatMoney(item.unit_price, currency)}
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
              {formatMoney(item.line_total, currency)}
            </TableCell>
          </TableRow>
        ))}
        {total !== undefined && (
          <TableRow>
            <TableCell colSpan={3} align="right" sx={{ fontWeight: 700, borderBottom: 0 }}>
              Total
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 700, whiteSpace: "nowrap", borderBottom: 0 }}>
              {formatMoney(total, currency)}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
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
function DispatchSummary({ dispatch, shopifyOrderId }) {
  const status = dispatchStatus(dispatch.status);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");

  const downloadLabel = async () => {
    setDownloading(true);
    setDownloadError("");
    try {
      const { ok } = await api.downloadDispatchLabel(shopifyOrderId, dispatch.id);
      if (!ok) setDownloadError("No se pudo descargar la guía.");
    } catch {
      setDownloadError("No se pudo conectar con el servidor.");
    } finally {
      setDownloading(false);
    }
  };

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
            {dispatch.label_source === "manual" && ` · cargada a mano (${dispatch.label_carrier})`}
            {dispatch.label_source === "canal" && " · del canal"}
          </Typography>
        )}
        {["envia", "manual"].includes(dispatch.label_source) && (
          <Button
            size="small"
            variant="outlined"
            disabled={downloading}
            onClick={(e) => {
              e.stopPropagation();
              downloadLabel();
            }}
          >
            {downloading ? "Descargando…" : "Descargar guía"}
          </Button>
        )}
      </Box>
      {downloadError && (
        <Typography variant="body2" color="error" sx={{ mt: 0.75 }}>
          {downloadError}
        </Typography>
      )}
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

// Guía que generó un tercero (hoy el RPA de Sodimac): estado, número,
// botón para pedirla al RPA y descarga del rótulo y la relación
// (`channel_label` del contrato).
function ChannelLabel({ order, onChanged }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const channel = order.channel_label;
  const status = channelLabelStatus(channel.status);
  const received = channel.status === "recibida";

  const requestLabel = async () => {
    const warning =
      "El RPA va a generar la guía de esta OC en el portal de Homecenter (es real). " +
      "Si aparece una validación, hay que resolverla en el visor del RPA. ¿Continuar?";
    if (!window.confirm(warning)) return;
    setBusy("request");
    setError("");
    setNotice("");
    try {
      const { ok, data } = await api.requestChannelLabel(order.shopify_order_id);
      if (ok) {
        setNotice("Pedida al RPA. La guía aparece aquí cuando el RPA termine.");
        onChanged?.();
      } else {
        setError(data?.detail || "No se pudo pedir la guía al RPA.");
      }
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy("");
    }
  };

  const download = async (kind) => {
    setBusy(kind);
    setError("");
    try {
      const { ok } = await api.downloadChannelLabel(order.shopify_order_id, kind);
      if (!ok) setError("No se pudo descargar el documento.");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setBusy("");
    }
  };

  return (
    <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1, bgcolor: "background.paper", p: 1.5 }}>
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" fontWeight={600}>
          Guía del portal (RPA)
        </Typography>
        {status && <StatusChip {...status} />}
        {received && (
          <Typography variant="body2" color="textSecondary">
            {channel.tracking_number} · recibida {formatDateTime(channel.received_at)}
          </Typography>
        )}
        {!received && channel.requested_at && (
          <Typography variant="body2" color="textSecondary">
            pedida {formatDateTime(channel.requested_at)}
          </Typography>
        )}
      </Box>
      {channel.note && (
        <Typography variant="body2" color="textSecondary" sx={{ mt: 0.75 }}>
          {channel.note}
        </Typography>
      )}
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.25 }} onClick={(e) => e.stopPropagation()}>
        {received ? (
          <>
            <Button size="small" variant="outlined" disabled={!!busy} onClick={() => download("rotulo")}>
              {busy === "rotulo" ? "Descargando…" : "Descargar rótulo"}
            </Button>
            <Button size="small" variant="outlined" disabled={!!busy} onClick={() => download("relacion")}>
              {busy === "relacion" ? "Descargando…" : "Descargar relación"}
            </Button>
          </>
        ) : (
          <Button size="small" variant="outlined" disabled={!!busy} onClick={requestLabel}>
            {busy === "request" ? "Pidiendo…" : "Generar guía (RPA)"}
          </Button>
        )}
        <Button size="small" variant="text" disabled={!!busy} onClick={() => setUploadOpen(true)}>
          {received ? "Reemplazar guía" : "Cargar guía"}
        </Button>
      </Box>
      {uploadOpen && (
        <UploadLabelDialog
          order={order}
          onClose={() => setUploadOpen(false)}
          onUploaded={() => {
            setUploadOpen(false);
            setNotice("Guía cargada.");
            onChanged?.();
          }}
        />
      )}
      {notice && (
        <Alert severity="success" sx={{ mt: 1 }} onClose={() => setNotice("")}>
          {notice}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
    </Box>
  );
}

// Carga manual de la guía (rótulo + relación) cuando el RPA no puede: p. ej.
// la guía ya estaba generada en el portal. El número es opcional: si falta,
// el backend lo lee del rótulo.
function UploadLabelDialog({ order, onClose, onUploaded }) {
  const [label, setLabel] = useState(null);
  const [relation, setRelation] = useState(null);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const { ok, data } = await api.uploadChannelLabel(order.shopify_order_id, {
        label,
        relation,
        trackingNumber: trackingNumber.trim(),
      });
      if (ok) onUploaded();
      else setError(data?.detail || "No se pudo cargar la guía.");
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onClose={saving ? undefined : onClose} fullWidth maxWidth="xs" onClick={(e) => e.stopPropagation()}>
      <DialogTitle>Cargar guía · pedido {order.shopify_order_name}</DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
        <FileField label="Rótulo (PDF)" file={label} onChange={setLabel} />
        <FileField label="Relación (PDF)" file={relation} onChange={setRelation} />
        <TextField
          size="small"
          label="Número de guía (opcional)"
          helperText="Si lo dejas vacío, se lee del rótulo."
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
        />
        {error && <Alert severity="error">{error}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="contained" onClick={submit} disabled={saving || !label || !relation}>
          {saving ? "Cargando…" : "Cargar"}
        </Button>
      </DialogActions>
    </Dialog>
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
