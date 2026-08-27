import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ordersApi } from "../api";


const cards = [
  ["total", "Pedidos", ""],
  ["without_guide", "Sin guía", "missing"],
  ["guide_without_tracking", "Guía sin trazabilidad", "present_without_tracking"],
  ["without_pdf", "PDF pendiente", "pdf_missing"],
  ["split", "Multibodega", ""],
  ["in_transit", "En tránsito", ""],
  ["delivered", "Entregados", ""],
  ["exceptions", "Con novedad", ""],
];


export default function SalesDashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    ordersApi.overview().then(setOverview).catch((reason) => setError(reason.message));
  }, []);

  return (
    <section className="orders-page sales-orders-dashboard">
      <header className="orders-page-heading">
        <div>
          <p className="eyebrow">VENTAS</p>
          <h1>Dashboard de pedidos</h1>
          <p>Lectura Beta de pedidos, despachos, guías y seguimiento.</p>
        </div>
        <span className="local-safety-pill">Proveedores externos · solo lectura</span>
      </header>
      {error && <div className="orders-alert error">{error}</div>}
      {!overview ? (
        <div className="orders-skeleton">Cargando indicadores…</div>
      ) : (
        <>
          <div className="orders-metric-grid">
            {cards.map(([key, label, guide]) => (
              <button
                type="button"
                key={key}
                onClick={() => navigate(`/ventas/pedidos${guide ? `?guide=${guide}` : ""}`)}
              >
                <span>{label}</span>
                <strong>{overview[key] ?? 0}</strong>
              </button>
            ))}
          </div>
          <article className="sales-total-card">
            <span>Ventas en el rango sincronizado</span>
            <strong>
              {new Intl.NumberFormat("es-CO", {
                style: "currency",
                currency: overview.currency || "COP",
                maximumFractionDigits: 0,
              }).format(Number(overview.sales_total || 0))}
            </strong>
            <small>Datos de la copia operativa de Beta; no modifica los canales externos.</small>
          </article>
        </>
      )}
    </section>
  );
}
