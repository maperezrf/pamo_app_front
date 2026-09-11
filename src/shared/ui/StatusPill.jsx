const LABELS = {
  DRAFT: "Borrador",
  SENT_TO_CONFIRM: "Enviada a confirmar",
  CONFIRMED: "Confirmada",
  PENDING_INVOICE: "Factura pendiente",
  INVOICING: "Facturando",
  INVOICED: "Facturada",
  INVOICE_FAILED: "Error de facturación",
  CANCELLED: "Anulada",
  PENDING: "Pendiente",
  COMPLETED: "Completada",
};

export default function StatusPill({ value }) {
  const success = ["CONFIRMED", "COMPLETED", "INVOICED"].includes(value);
  const danger = ["CANCELLED", "INVOICE_FAILED"].includes(value);
  return <span className={`rm-status${success ? " success" : ""}${danger ? " danger" : ""}`}>{LABELS[value] ?? value}</span>;
}
