// Etiquetas del área de facturación. Los valores vienen del contrato
// `GET /api/invoicing/` (backend/docs/contracts/API.md); un valor
// desconocido se muestra tal cual.

// Canales que facturan desde Pamo (sin "Shopify": no hay factura sin
// marketplace).
export const INVOICE_MARKETPLACE_OPTIONS = [
  { value: "falabella", label: "Falabella" },
  { value: "mercadolibre", label: "Mercado Libre" },
  { value: "madecentro", label: "Madecentro" },
  { value: "sodimac", label: "Sodimac" },
];

// `Invoice.Status` del backend → [etiqueta, tono de StatusChip, explicación].
const INVOICE_STATUS = {
  creada: ["Creada", "success", "Factura creada en Siigo."],
  error: ["Error", "error", "Siigo rechazó la factura: no existe. La siguiente corrida la reintenta."],
  creando: [
    "Sin confirmar",
    "error",
    "Se cortó mientras se creaba: no se sabe si existe en Siigo. Revisar en Siigo; no se reintenta sola.",
  ],
};

export const INVOICE_STATUS_OPTIONS = Object.entries(INVOICE_STATUS).map(([value, [label]]) => ({ value, label }));

export function invoiceStatus(value) {
  if (!value) return null;
  const [label, tone, description] = INVOICE_STATUS[value] ?? [value, "neutral", ""];
  return { label, tone, description };
}

// Qué hacer ante un rechazo de Siigo conocido (`error_message` tal cual).
export function invoiceErrorHint(message) {
  if (!message) return "";
  if (message.startsWith("The code doesn't exist")) {
    return "Ese SKU no existe como producto en Siigo. Créalo en Siigo (o corrige la equivalencia del catálogo); la siguiente corrida la reintenta.";
  }
  if (message.startsWith("The total payments must be equal to the total invoice")) {
    return "Diferencia de total con Siigo: la siguiente corrida la reintenta sola con el total que calculó Siigo.";
  }
  return "";
}
