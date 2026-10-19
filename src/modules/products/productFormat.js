// Etiquetas y constantes del área de productos (contrato en
// backend/docs/contracts/API.md, reglas en backend/docs/apps/products.md).

// Canales que gestiona esta pantalla (carga, listado y acordeón). El backend
// acepta también falabella y mercadolibre; por ahora no se ofrecen.
export const SKU_UPLOAD_MARKETPLACES = ["sodimac", "madecentro"];

export const SKU_UPLOAD_COLUMNS = ["sku_pamo", "sku_marketplace", "ean"];
export const KIT_COLUMNS = ["kit_sku", "component_sku", "quantity"];

// Tope de filas de `POST /api/products/sku-uploads/` (SKU_UPLOAD_MAX_ROWS).
export const SKU_UPLOAD_MAX_ROWS = 2000;

// Estados finales del orquestador: al llegar a uno se corta el polling.
const FINAL_STATUSES = ["COMPLETADO", "ERROR", "CANCELADO", "INTERRUMPIDO"];
export const isFinalStatus = (status) => FINAL_STATUSES.includes(status);

const UPLOAD_STATUSES = {
  PENDIENTE: { label: "En espera", tone: "neutral" },
  EN_COLA: { label: "En espera", tone: "neutral" },
  EJECUTANDO: { label: "Procesando", tone: "neutral" },
  CANCELANDO: { label: "Cancelando", tone: "neutral" },
  COMPLETADO: { label: "Terminada", tone: "success" },
  ERROR: { label: "Falló", tone: "error" },
  CANCELADO: { label: "Cancelada", tone: "error" },
  INTERRUMPIDO: { label: "Interrumpida", tone: "error" },
};

export const uploadStatus = (status) => UPLOAD_STATUSES[status] ?? { label: status ?? "En espera", tone: "neutral" };

// `resultado_codigo` de cada fila del reporte.
export const RESULT_CODES = [
  { value: "ok", label: "Exitosas", tone: "success" },
  { value: "alert", label: "Alertas", tone: "neutral" },
  { value: "error", label: "Errores", tone: "error" },
];

// Errores de validación del backend (`{campo: [mensajes]}` o `{detail}`) → un texto.
export function errorMessage(data, fallback) {
  if (!data || typeof data !== "object") return fallback;
  if (data.detail) return String(data.detail);
  return Object.values(data).flat().join(" ") || fallback;
}
