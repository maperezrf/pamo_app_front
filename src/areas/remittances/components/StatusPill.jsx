const LABELS = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  CANCELLED: "Anulada",
  PENDING: "Pendiente",
  COMPLETED: "Completada",
  PENDING_CODING: "Pendiente de codificación",
  READY: "Lista para facturar",
  INVOICING: "Facturando",
  INVOICED: "Facturada",
  ERROR: "Error",
};

export default function StatusPill({ value }) {
  const success = ["CONFIRMED", "COMPLETED", "READY", "INVOICED"].includes(value);
  const danger = ["CANCELLED", "ERROR"].includes(value);
  return <span className={`rm-status${success ? " success" : ""}${danger ? " danger" : ""}`}>{LABELS[value] ?? value}</span>;
}
