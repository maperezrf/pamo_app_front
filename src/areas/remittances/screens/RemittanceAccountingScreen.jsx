import { useCallback, useEffect, useMemo, useState } from "react";
import { remittancesApi } from "../api";
import StatusPill from "../components/StatusPill";
import "../styles/remittances.css";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "Pendiente";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value));
}

export default function RemittanceAccountingScreen() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewStatus, setPreviewStatus] = useState("idle");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    const response = await remittancesApi.accountingQueue();
    if (!response.ok) {
      setError(response.status === 403 ? "No tienes permiso para Facturación de remisiones." : response.data?.detail ?? "No se pudo cargar la cola.");
      setStatus("error");
      return;
    }
    setItems(response.data);
    setSelectedId((current) => current && response.data.some((item) => item.id === current) ? current : response.data[0]?.id ?? null);
    setStatus("ready");
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) return items;
    return items.filter((item) => `${item.number ?? "BORRADOR"} ${item.customer_detail.name} ${item.customer_detail.nit}`.includes(normalized));
  }, [items, query]);
  const selected = items.find((item) => item.id === selectedId) ?? null;

  const requestPreview = async () => {
    if (!selected) return;
    setPreviewStatus("loading");
    setPreview(null);
    setError("");
    const response = await remittancesApi.invoicePreview(selected.id);
    if (!response.ok) {
      setError(response.data?.lines ?? response.data?.detail ?? "No fue posible preparar la vista previa.");
      setPreviewStatus("error");
      return;
    }
    setPreview(response.data);
    setPreviewStatus("ready");
  };

  return (
    <section className="rm-page">
      <header className="rm-page-header">
        <div>
          <span className="rm-eyebrow">Facturación</span>
          <h1>Facturación de remisiones</h1>
          <p>Cola separada para codificar, revisar precios y preparar Siigo con control humano.</p>
        </div>
        <button type="button" className="rm-button secondary" onClick={load}>Actualizar cola</button>
      </header>

      <div className="rm-security-banner">
        <strong>Modo controlado.</strong> Las escrituras externas y la emisión real a Siigo permanecen desactivadas en esta fase.
      </div>
      {error && <div className="rm-notice error" role="alert"><strong>No se completó la operación.</strong> {String(error)}</div>}

      <div className="rm-toolbar">
        <label className="rm-search">Buscar remisión o cliente
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="RD-0001 o LAO KAO" />
        </label>
      </div>

      <div className="rm-accounting-layout">
        <div className="rm-queue" aria-label="Cola contable">
          {status === "loading" && <div className="rm-state">Cargando cola…</div>}
          {status === "ready" && visible.length === 0 && <div className="rm-state">No hay remisiones para este filtro.</div>}
          {visible.map((item) => (
            <button type="button" className={`rm-queue-item${item.id === selectedId ? " selected" : ""}`} key={item.id} onClick={() => { setSelectedId(item.id); setPreview(null); setPreviewStatus("idle"); }}>
              <span><strong>{item.number ?? "Borrador"}</strong><small>{item.customer_detail.name} · NIT {item.customer_detail.nit}</small></span>
              <span><strong>{item.lines.filter((line) => line.siigo_sku && line.invoice_unit_price).length}/{item.lines.length} vinculados</strong><StatusPill value={item.invoice_status} /></span>
            </button>
          ))}
        </div>

        <aside className="rm-detail">
          {!selected && <div className="rm-state">Selecciona una remisión.</div>}
          {selected && (
            <>
              <div className="rm-detail-head">
                <div><span className="rm-eyebrow">{selected.number ?? "Borrador"}</span><h2>{selected.customer_detail.name}</h2><p>NIT {selected.customer_detail.nit} · {selected.requester_name}</p></div>
                <StatusPill value={selected.invoice_status} />
              </div>
              <div className="rm-accounting-meta">
                <span><small>Medio de pago</small><strong>Crédito · 15 días</strong></span>
                <span><small>Entrega</small><strong><StatusPill value={selected.delivery_status} /></strong></span>
              </div>
              <h3>Productos de la remisión</h3>
              <div className="rm-accounting-lines">
                {selected.lines.map((line) => (
                  <article key={line.id}>
                    <div><strong>{line.quantity} × {line.original_description}</strong><small>Destino: {line.usage_destination || "SIN DEFINIR"}</small></div>
                    <div><small>SKU Siigo</small><strong>{line.siigo_sku || "Pendiente de vincular"}</strong><small>{line.invoice_description || "Usará la descripción original"}</small></div>
                    <div><small>Precio unitario</small><strong>{formatMoney(line.invoice_unit_price)}</strong></div>
                  </article>
                ))}
              </div>
              <div className="rm-invoice-actions">
                <button type="button" className="rm-button primary" onClick={requestPreview} disabled={previewStatus === "loading"}>
                  {previewStatus === "loading" ? "Validando…" : "Generar vista previa"}
                </button>
                <span>La emisión se habilitará solo después de migrar y probar el adaptador Siigo.</span>
              </div>
              {preview && (
                <section className="rm-preview">
                  <div><span className="rm-eyebrow">Vista previa</span><h3>{preview.remittance_number}</h3></div>
                  {preview.items.map((item) => <p key={item.line_number}>{item.quantity} × {item.description} <strong>{formatMoney(item.total)}</strong></p>)}
                  <div className="rm-preview-total"><span>Subtotal</span><strong>{formatMoney(preview.subtotal)}</strong></div>
                </section>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}
