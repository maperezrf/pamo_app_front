import { useCallback, useEffect, useMemo, useState } from "react";
import { remittancesApi } from "../api";
import RemittanceCreatePanel from "../components/RemittanceCreatePanel";
import StatusPill from "../components/StatusPill";
import "../styles/remittances.css";

function messageFrom(response, fallback) {
  if (response.status === 401) return "La sesión venció. Vuelve a iniciar sesión.";
  if (response.status === 403) return "No tienes permiso para operar Remisiones.";
  const data = response.data;
  if (!data || typeof data === "string") return fallback;
  if (typeof data.detail === "string") return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return first.filter((item) => typeof item === "string").join(" ") || fallback;
  return typeof first === "string" ? first : fallback;
}

export default function RemittancesOperationsScreen() {
  const [items, setItems] = useState([]);
  const [referenceData, setReferenceData] = useState({
    warehouses: [],
    favorites: [],
    authorized_people: [],
    usage_destinations: [],
  });
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const showsData = ["ready", "refreshing", "stale"].includes(status);

  const load = useCallback(async () => {
    setStatus((current) => ["ready", "refreshing", "stale"].includes(current) ? "refreshing" : "loading");
    setError("");
    const [listResponse, referenceResponse] = await Promise.all([
      remittancesApi.list(),
      remittancesApi.referenceData(),
    ]);
    if (!listResponse.ok || !referenceResponse.ok) {
      const failed = !listResponse.ok ? listResponse : referenceResponse;
      setError(messageFrom(failed, "No fue posible cargar Remisiones."));
      setStatus((current) => ["refreshing", "ready", "stale"].includes(current) ? "stale" : "error");
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

  const create = async (payload, supplierInvoiceFile = null) => {
    setSubmitting(true);
    setError("");
    const response = await remittancesApi.create(payload);
    if (!response.ok) {
      setSubmitting(false);
      setError(messageFrom(response, "No se pudo guardar el borrador."));
      return;
    }
    if (supplierInvoiceFile) {
      const attachment = await remittancesApi.attachSupplierInvoice(response.data.id, supplierInvoiceFile);
      if (!attachment.ok) {
        setSubmitting(false);
        setItems((current) => [response.data, ...current]);
        setCreating(false);
        setError(`El borrador se guardó, pero la factura privada no quedó adjunta: ${messageFrom(attachment, "intenta adjuntarla nuevamente.")}`);
        return;
      }
    }
    setSubmitting(false);
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

  const shareForSignature = async (item) => {
    setError("");
    const response = await remittancesApi.prepareWhatsApp(item.id, window.location.origin);
    if (!response.ok) {
      setError(messageFrom(response, "No se pudo preparar el enlace de firma."));
      return;
    }
    window.location.assign(response.data.whatsapp_url);
  };

  const openDocument = async (item, download = false) => {
    const previewWindow = download ? null : window.open("about:blank", "_blank");
    setError("");
    const response = await remittancesApi.clientDocument(item.id, download);
    if (!response.ok) {
      previewWindow?.close();
      setError(messageFrom(response, "No se pudo generar el PDF de la remisión."));
      return;
    }
    const url = URL.createObjectURL(response.data);
    if (download) {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${item.number ?? "remision"}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return;
    }
    if (previewWindow) previewWindow.location.replace(url);
    else window.location.assign(url);
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <section className="rm-page">
      <header className="rm-page-header">
        <div>
          <span className="rm-eyebrow">Ventas</span>
          <h1>Remisiones</h1>
          <p>Captura operativa, entrega y trazabilidad sin exponer precios al cliente.</p>
        </div>
        <button type="button" className="rm-button primary" onClick={() => setCreating(true)} disabled={!showsData}>
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
      {status === "stale" && <div className="rm-notice warning" role="status"><strong>Mostrando la última información disponible.</strong> La actualización falló; no se borró la lista.</div>}
      {status === "refreshing" && <div className="rm-progress" role="status"><span /> Actualizando sin ocultar las remisiones…</div>}
      {status === "loading" && <div className="rm-state">Cargando remisiones…</div>}
      {showsData && visible.length === 0 && <div className="rm-state">No hay remisiones para este filtro.</div>}
      {showsData && visible.length > 0 && (
        <div className="rm-list" aria-label="Remisiones">
          {visible.map((item) => (
            <article className="rm-row-card" key={item.id}>
              <div><span className="rm-row-label">Remisión</span><strong>{item.number ?? "Borrador"}</strong><small>{new Date(item.created_at).toLocaleString("es-CO")}</small></div>
              <div><span className="rm-row-label">Cliente</span><strong>{item.customer_detail.name}</strong><small>NIT {item.customer_detail.nit}</small></div>
              <div><span className="rm-row-label">Solicitante</span><strong>{item.requester_name}</strong><small>{item.lines.length} producto(s)</small></div>
              <div className="rm-statuses"><StatusPill value={item.document_status} /><StatusPill value={item.delivery_status} /><span className={`rm-status${item.signature_status === "SIGNED" ? " success" : ""}`}>{item.signature_status === "SIGNED" ? `Firma OK · ${item.signed_by}` : "Firma pendiente"}</span></div>
              <div className="rm-row-actions">
                {item.document_status === "DRAFT" && <button type="button" className="rm-button secondary" onClick={() => confirm(item)}>Confirmar</button>}
                {item.document_status === "CONFIRMED" && item.signature_status !== "SIGNED" && <button type="button" className="rm-button whatsapp" onClick={() => shareForSignature(item)}>Enviar para firmar</button>}
                {item.document_status === "CONFIRMED" && <button type="button" className="rm-button secondary" onClick={() => openDocument(item)}>{item.signature_status === "SIGNED" ? "Ver PDF firmado" : "Ver PDF"}</button>}
                {item.document_status === "CONFIRMED" && <button type="button" className="rm-link-button" onClick={() => openDocument(item, true)}>Descargar</button>}
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
