// Etiquetas y formato del área de pedidos. Los valores vienen del contrato
// `GET /api/orders/` (backend/docs/contracts/API.md); un valor desconocido se
// muestra tal cual en vez de ocultarse.

import falabellaLogo from "../../assets/marketplaces/falabella.png";
import madecentroLogo from "../../assets/marketplaces/madecentro.png";
import mercadolibreLogo from "../../assets/marketplaces/mercadolibre.png";
import shopifyLogo from "../../assets/marketplaces/shopify.png";
import sodimacLogo from "../../assets/marketplaces/sodimac.png";

export const MARKETPLACE_OPTIONS = [
  { value: "falabella", label: "Falabella" },
  { value: "mercadolibre", label: "Mercado Libre" },
  { value: "madecentro", label: "Madecentro" },
  { value: "sodimac", label: "Sodimac" },
  { value: "shopify", label: "Shopify (sin marketplace)" },
];

const MARKETPLACE_LABELS = Object.fromEntries(MARKETPLACE_OPTIONS.map((o) => [o.value, o.label]));
MARKETPLACE_LABELS.shopify = "Shopify";

// Estados de Shopify: [etiqueta, tono de StatusChip].
const FINANCIAL_STATUS = {
  PAID: ["Pagado", "success"],
  PENDING: ["Pago pendiente", "neutral"],
  AUTHORIZED: ["Autorizado", "neutral"],
  PARTIALLY_PAID: ["Pago parcial", "neutral"],
  PARTIALLY_REFUNDED: ["Reembolso parcial", "neutral"],
  REFUNDED: ["Reembolsado", "error"],
  VOIDED: ["Anulado", "error"],
  EXPIRED: ["Expirado", "error"],
};

const SHOPIFY_FULFILLMENT_STATUS = {
  FULFILLED: ["Despachado", "success"],
  PARTIALLY_FULFILLED: ["Despacho parcial", "neutral"],
  UNFULFILLED: ["Sin despachar", "neutral"],
};

// `MarketplaceOrder.Status` en backend (pedidos no creados).
const NOT_CREATED_STATUS = {
  pending: "Pendiente",
  procesando: "Procesando",
  error_creando_cliente: "Error al crear cliente",
  error_creando_orden: "Error al crear orden",
};

// Ícono del sitio de cada canal (Sodimac Colombia opera como Homecenter).
const MARKETPLACE_LOGOS = {
  falabella: falabellaLogo,
  mercadolibre: mercadolibreLogo,
  madecentro: madecentroLogo,
  sodimac: sodimacLogo,
  shopify: shopifyLogo,
};

export const marketplaceLogo = (value) => MARKETPLACE_LOGOS[value] ?? null;

export const marketplaceLabel = (value) => MARKETPLACE_LABELS[value] ?? value ?? "—";

export const financialStatus = (value) => statusFrom(FINANCIAL_STATUS, value);

export const shopifyFulfillmentStatus = (value) => statusFrom(SHOPIFY_FULFILLMENT_STATUS, value);

export const notCreatedStatusLabel = (value) => NOT_CREATED_STATUS[value] ?? value;

function statusFrom(map, value) {
  if (!value) return null;
  const [label, tone] = map[value] ?? [value, "neutral"];
  return { label, tone };
}

// Bodega de despacho (`fulfillment` del contrato) → texto y tono.
export function warehouse(fulfillment) {
  const { status, location_name: name, note } = fulfillment ?? {};
  if (status === "novedad") return { label: "Novedad", tone: "error", detail: note };
  if (status === "asignada") return { label: name || "Asignada", tone: "success" };
  if (status === "resuelta_manual") return { label: name || "Resuelta manual", tone: "neutral", detail: "Resuelta manualmente" };
  return null;
}

export function customerName(customer) {
  const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(" ");
  return name || "—";
}

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso) {
  return iso ? dateTimeFormat.format(new Date(iso)) : "—";
}

// Importes llegan como string con 2 decimales; `""` = sin importe.
export function formatMoney(amount, currency = "COP") {
  if (amount === "" || amount == null) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currency || "COP",
    maximumFractionDigits: 2,
  }).format(Number(amount));
}
