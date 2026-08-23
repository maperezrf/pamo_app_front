import { useCallback, useEffect, useMemo, useState } from "react";
import { remittancesApi } from "../api";
import RemittanceCreatePanel from "../components/RemittanceCreatePanel";
import StatusPill from "../components/StatusPill";
import "../styles/remittances.css";

function messageFrom(response, fallback) {
  if (response.status === 401) return "La sesión venció. Vuelve a iniciar sesión.";
  if (response.status === 403) return "No tienes permiso para operar Remisiones.";
  return response.data?.detail ?? Object.values(response.data ?? {})[0] ?? fallback;
}

export default function RemittancesOperationsScreen() {
  const [items, setItems] = useState([]);
  const [referenceData, setReferenceData] = useState({ warehouses: [], favorites: [] });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    const [listResponse, referenceResponse] = await Promise.all([
      remittancesApi.list(),
      remittancesApi.referenceData(),
    ]);
    if (!listResponse.ok || !referenceResponse.ok) {
      const failed = !listResponse.ok ? listResponse : referenceResponse;
      setError(messageFrom(failed, "No fue posible cargar Remisiones."));
      setStatus("error");
      return;
    }
    setItems(listResponse.data);
    setReferenceData(referenceResponse.data);
    setStatus("ready");
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const normalized = query.trim().toUpperCase();
    if (!normalized) return items;
    return items.filter((item) => [
      item.number ?? "BORRADOR",
      item.customer_detail.name,
      item.supplier_detail.name,
      item.requester_name,
    ].some((value) => value.includes(normalized)));
  }, [items, query]);

  const create = async (payload) => {
    setSubmitting(true);
    setError("");
    const response = await remittancesApi.create(payload);
    setSubmitting(false);
    if (!response.ok) {
      setError(messageFrom(response, "No se pudo guardar el borrador."));
      return;
    }
    setItems((current) => [response.data, ...current]);
    setCreating(false);
  };

  const confirm = async (item) => {
    setError("");
    const response = await remittancesApi.confirm(item.id, item.version);
    if (!response.ok) {
      setError(messageFrom(response, "No se pudo confirmar la remisión."));
      return;
    }
    setItems((current) => current.map((row) => row.id === item.id ? response.data : row));
  };

  return (
    <section className="rm-page">
      <header className="rm-page-header">
        <div>
          <span className="rm-eyebrow">Ventas</span>
          <h1>Remisiones</h1>
          <p>Captura operativa, entrega y trazabilidad sin exponer precios al cliente.</p>
        </div>
        <button type="button" className="rm-button primary" onClick={() => setCreating(true)} disabled={status !== "ready"}>
          Nueva remisión
        </button>
      </header>

      <div className="rm-toolbar">
        <label className="rm-search">Buscar
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="RD, cliente, proveedor o solicitante" />
        </label>
        <button type="button" className="rm-button secondary" onClick={load}>Actualizar</button>
      </div>

      {error && <div className="rm-notice error" role="alert"><strong>No se completó la operación.</strong> {String(error)}</div>}
      {status === "loading" && <div className="rm-state">Cargando remisiones…</div>}
      {status === "ready" && visible.length === 0 && <div className="rm-state">No hay remisiones para este filtro.</div>}
      {status === "ready" && visible.length > 0 && (
        <div className="rm-list" aria-label="Remisiones">
          {visible.map((item) => (
            <article className="rm-row-card" key={item.id}>
              <div><span className="rm-row-label">Remisión</span><strong>{item.number ?? "Borrador"}</strong><small>{new Date(item.created_at).toLocaleString("es-CO")}</small></div>
              <div><span className="rm-row-label">Cliente</span><strong>{item.customer_detail.name}</strong><small>NIT {item.customer_detail.nit}</small></div>
              <div><span className="rm-row-label">Solicitante</span><strong>{item.requester_name}</strong><small>{item.lines.length} producto(s)</small></div>
              <div className="rm-statuses"><StatusPill value={item.document_status} /><StatusPill value={item.delivery_status} /></div>
              <div className="rm-row-actions">
                {item.document_status === "DRAFT" && <button type="button" className="rm-button secondary" onClick={() => confirm(item)}>Confirmar</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {creating && (
        <RemittanceCreatePanel
          referenceData={referenceData}
          onClose={() => setCreating(false)}
          onCreate={create}
          submitting={submitting}
        />
      )}
    </section>
  );
}
