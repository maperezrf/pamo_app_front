// Formato y enlaces comunes a las áreas (pedidos, facturación). Fechas en
// hora de Colombia; importes como los entrega el backend (string con 2
// decimales).

const dateTimeFormat = new Intl.DateTimeFormat("es-CO", {
  timeZone: "America/Bogota",
  dateStyle: "medium",
  timeStyle: "short",
});

const dateFormat = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", dateStyle: "medium" });

export function formatDateTime(iso) {
  return iso ? dateTimeFormat.format(new Date(iso)) : "—";
}

// Fecha sin hora (`YYYY-MM-DD`): se formatea en UTC para que no cambie de día.
export function formatDate(isoDate) {
  return isoDate ? dateFormat.format(new Date(`${isoDate}T00:00:00Z`)) : "—";
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

// Admin de Shopify de la tienda (`VITE_SHOPIFY_ADMIN_URL`, ej.
// https://admin.shopify.com/store/<tienda>). Sin configurar → sin enlaces.
const SHOPIFY_ADMIN_URL = (import.meta.env?.VITE_SHOPIFY_ADMIN_URL ?? "").replace(/\/+$/, "");

export function shopifyOrderUrl(shopifyOrderId) {
  return SHOPIFY_ADMIN_URL && shopifyOrderId ? `${SHOPIFY_ADMIN_URL}/orders/${shopifyOrderId}` : null;
}

export function shopifyDraftOrderUrl(draftOrderId) {
  return SHOPIFY_ADMIN_URL && draftOrderId ? `${SHOPIFY_ADMIN_URL}/draft_orders/${draftOrderId}` : null;
}

// Las líneas locales no guardan el id del producto: se abre la búsqueda de
// productos del admin por SKU.
export function shopifyProductSearchUrl(sku) {
  return SHOPIFY_ADMIN_URL && sku ? `${SHOPIFY_ADMIN_URL}/products?query=${encodeURIComponent(sku)}` : null;
}
