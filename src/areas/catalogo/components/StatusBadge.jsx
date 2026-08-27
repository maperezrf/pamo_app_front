const labels = {
  EXACT: "SKU exacto",
  DUPLICATE: "Duplicado",
  MISSING: "Faltante",
  AMBIGUOUS: "Ambiguo",
  REVIEW_PENDING: "En revisión",
  LOCAL_SNAPSHOT: "Snapshot local",
  ACTIVE: "Activo",
  DRAFT: "Borrador",
};

export default function StatusBadge({ value, tone }) {
  const normalized = String(value || "PENDING").toLowerCase().replaceAll("_", "-");
  return <span className={`catalog-status ${tone || normalized}`}>{labels[value] || value || "Pendiente"}</span>;
}
