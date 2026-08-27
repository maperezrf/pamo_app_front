import { useCallback, useEffect, useMemo, useState } from "react";
import { remittancesApi } from "../api";
import StatusPill from "../components/StatusPill";
import "../styles/remittances.css";

function formatMoney(value) {
  if (value === null || value === undefined || value === "") return "Pendiente";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value));
}

function editableValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function privateNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function privateDraftFrom(remittance) {
  return {
    supplier_global_discount_percent: editableValue(remittance.supplier_global_discount_percent),
    supplier_global_discount_value: editableValue(remittance.supplier_global_discount_value),
    supplier_other_charges: editableValue(remittance.supplier_other_charges),
    supplier_freight_cost: editableValue(remittance.supplier_freight_cost),
    lines: remittance.lines.map((line) => ({
      id: line.id,
      supplier_sku: line.supplier_sku ?? "",
      supplier_unit_cost: editableValue(line.supplier_unit_cost),
      supplier_line_total: editableValue(line.supplier_line_total),
      supplier_discount_percent: editableValue(line.supplier_discount_percent),
      supplier_discount_value: editableValue(line.supplier_discount_value),
    })),
  };
}

function commercialDraftFrom(remittance) {
  const defaultMargin = editableValue(remittance.default_margin_percent ?? 35);
  return {
    default_margin_percent: defaultMargin,
    lines: remittance.lines.map((line) => ({
      id: line.id,
      siigo_sku: line.siigo_sku ?? "",
      siigo_name: line.invoice_description ?? "",
      invoice_description: line.invoice_description || line.original_description,
      invoice_margin_percent: editableValue(line.invoice_margin_percent ?? defaultMargin),
      override_reason: line.override_reason ?? "",
    })),
  };
}

function messageFrom(response, fallback) {
  if (response.status === 401) return "La sesión venció. Vuelve a iniciar sesión.";
  if (response.status === 403) return "No tienes permiso para Facturación de remisiones.";
  const data = response.data;
  if (!data || typeof data === "string") return fallback;
  if (typeof data.detail === "string") return data.detail;
  const first = Object.values(data)[0];
  if (Array.isArray(first)) return first.filter((item) => typeof item === "string").join(" ") || fallback;
  return typeof first === "string" ? first : fallback;
}

export default function RemittanceAccountingScreen() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewStatus, setPreviewStatus] = useState("idle");
  const [siigoPreflight, setSiigoPreflight] = useState(null);
  const [siigoPreflightStatus, setSiigoPreflightStatus] = useState("idle");
  const [draftConfirmed, setDraftConfirmed] = useState(false);
  const [draftCreateStatus, setDraftCreateStatus] = useState("idle");
  const [draftResult, setDraftResult] = useState(null);
  const [privateDraft, setPrivateDraft] = useState(null);
  const [privateSaveStatus, setPrivateSaveStatus] = useState("idle");
  const [commercialDraft, setCommercialDraft] = useState(null);
  const [commercialSaveStatus, setCommercialSaveStatus] = useState("idle");
  const [skuDialog, setSkuDialog] = useState(null);
  const [localSignatureUrl, setLocalSignatureUrl] = useState("");
  const showsData = ["ready", "refreshing", "stale"].includes(status);

  const load = useCallback(async () => {
    setStatus((current) => ["ready", "refreshing", "stale"].includes(current) ? "refreshing" : "loading");
    setError("");
    const response = await remittancesApi.accountingQueue();
    if (!response.ok) {
      setError(messageFrom(response, "No se pudo cargar la cola."));
      setStatus((current) => ["refreshing", "ready", "stale"].includes(current) ? "stale" : "error");
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

  useEffect(() => {
    setPrivateDraft(selected ? privateDraftFrom(selected) : null);
    setPrivateSaveStatus("idle");
    setCommercialDraft(selected ? commercialDraftFrom(selected) : null);
    setCommercialSaveStatus("idle");
    setSkuDialog(null);
    setLocalSignatureUrl("");
    setPreview(null);
    setPreviewStatus("idle");
    setSiigoPreflight(null);
    setSiigoPreflightStatus("idle");
    setDraftConfirmed(false);
    setDraftCreateStatus("idle");
    setDraftResult(null);
  }, [selected]);

  const updatePrivateGlobal = (field, value) => {
    setPrivateDraft((current) => ({ ...current, [field]: value }));
  };

  const updatePrivateLine = (lineId, field, value) => {
    setPrivateDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => line.id === lineId ? { ...line, [field]: value } : line),
    }));
  };

  const savePrivateAdjustments = async () => {
    if (!selected || !privateDraft) return;
    setError("");
    setPrivateSaveStatus("saving");
    const response = await remittancesApi.updateAccounting(selected.id, {
      expected_version: selected.version,
      supplier_global_discount_percent: privateNumber(privateDraft.supplier_global_discount_percent),
      supplier_global_discount_value: privateNumber(privateDraft.supplier_global_discount_value),
      supplier_other_charges: privateNumber(privateDraft.supplier_other_charges),
      supplier_freight_cost: privateNumber(privateDraft.supplier_freight_cost),
      lines: privateDraft.lines.map((line) => ({
        id: line.id,
        supplier_sku: line.supplier_sku,
        supplier_unit_cost: privateNumber(line.supplier_unit_cost),
        supplier_line_total: privateNumber(line.supplier_line_total),
        supplier_discount_percent: privateNumber(line.supplier_discount_percent),
        supplier_discount_value: privateNumber(line.supplier_discount_value),
      })),
    });
    if (!response.ok) {
      setError(messageFrom(response, "No fue posible guardar los ajustes privados."));
      setPrivateSaveStatus("error");
      return;
    }
    setItems((current) => current.map((item) => item.id === response.data.id ? response.data : item));
    setPrivateSaveStatus("saved");
  };

  const updateCommercialLine = (lineId, field, value) => {
    setCommercialDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => line.id === lineId ? { ...line, [field]: value } : line),
    }));
    setCommercialSaveStatus("idle");
  };

  const applyMarginToAll = () => {
    setCommercialDraft((current) => ({
      ...current,
      lines: current.lines.map((line) => ({
        ...line,
        invoice_margin_percent: current.default_margin_percent,
      })),
    }));
    setCommercialSaveStatus("idle");
  };

  const openSkuSearch = (line) => {
    setSkuDialog({
      lineId: line.id,
      query: line.supplier_sku || line.original_description,
      results: [],
      status: "idle",
      error: "",
    });
  };

  const searchSiigo = async () => {
    if (!skuDialog || skuDialog.query.trim().length < 2) {
      setSkuDialog((current) => ({ ...current, error: "Escribe al menos 2 caracteres." }));
      return;
    }
    setSkuDialog((current) => ({ ...current, status: "loading", error: "" }));
    const response = await remittancesApi.searchSiigoProducts(skuDialog.query.trim());
    if (!response.ok) {
      setSkuDialog((current) => ({
        ...current,
        status: "error",
        error: messageFrom(response, "No fue posible consultar el catálogo local de Siigo."),
      }));
      return;
    }
    setSkuDialog((current) => ({
      ...current,
      status: "ready",
      results: response.data.results ?? [],
      error: "",
    }));
  };

  const selectSiigoProduct = (product) => {
    updateCommercialLine(skuDialog.lineId, "siigo_sku", product.sku);
    updateCommercialLine(skuDialog.lineId, "siigo_name", product.name);
    setSkuDialog(null);
  };

  const saveCommercialPreparation = async () => {
    if (!selected || !commercialDraft) return;
    setError("");
    setCommercialSaveStatus("saving");
    const response = await remittancesApi.updateCommercialPreparation(selected.id, {
      expected_version: selected.version,
      default_margin_percent: privateNumber(commercialDraft.default_margin_percent),
      lines: commercialDraft.lines.map((line) => ({
        id: line.id,
        siigo_sku: line.siigo_sku,
        invoice_description: line.invoice_description,
        invoice_margin_percent: privateNumber(line.invoice_margin_percent),
        override_reason: line.override_reason,
      })),
    });
    if (!response.ok) {
      setError(messageFrom(response, "No fue posible calcular y guardar la preparación para Siigo."));
      setCommercialSaveStatus("error");
      return;
    }
    setItems((current) => current.map((item) => item.id === response.data.id ? response.data : item));
    setCommercialSaveStatus("saved");
  };

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
    if (response.data.siigo_preflight?.status === "READY_FOR_CONTROLLED_DRAFT") {
      setSiigoPreflight(response.data.siigo_preflight);
      setSiigoPreflightStatus("ready");
    }
    setPreviewStatus("ready");
  };

  const requestSiigoPreflight = async () => {
    if (!selected) return;
    setSiigoPreflightStatus("loading");
    setSiigoPreflight(null);
    setError("");
    const response = await remittancesApi.siigoInvoicePreflight(selected.id);
    if (!response.ok) {
      setError(messageFrom(response, "No fue posible validar la parametrización fiscal en Siigo."));
      setSiigoPreflightStatus("error");
      return;
    }
    setSiigoPreflight(response.data);
    setSiigoPreflightStatus("ready");
  };

  const createSiigoDraft = async () => {
    if (!selected || !draftConfirmed || siigoPreflight?.status !== "READY_FOR_CONTROLLED_DRAFT") return;
    setDraftCreateStatus("loading");
    setDraftResult(null);
    setError("");
    const response = await remittancesApi.createSiigoDraft(selected.id);
    if (!response.ok) {
      setError(messageFrom(response, "No fue posible crear el borrador controlado en Siigo."));
      setDraftCreateStatus("error");
      return;
    }
    setDraftResult(response.data);
    setDraftCreateStatus("ready");
  };

  const downloadSupplierInvoice = async (file) => {
    if (!selected) return;
    setError("");
    const response = await remittancesApi.downloadSupplierInvoice(selected.id, file.id);
    if (!response.ok) {
      setError("No fue posible descargar la factura privada del proveedor.");
      return;
    }
    const url = URL.createObjectURL(response.data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.original_name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const resendForSignature = async () => {
    if (!selected) return;
    const isLocalPreview = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
    setError("");
    setLocalSignatureUrl("");
    const response = await remittancesApi.prepareWhatsApp(selected.id, window.location.origin);
    if (!response.ok) {
      setError(response.data?.detail ?? "No se pudo preparar el enlace de firma.");
      return;
    }
    if (isLocalPreview && response.data.public_url) {
      setLocalSignatureUrl(response.data.public_url);
      return;
    }
    window.location.assign(response.data.whatsapp_url);
  };

  const openClientDocument = async (download = false) => {
    if (!selected) return;
    const previewWindow = download ? null : window.open("about:blank", "_blank");
    setError("");
    const response = await remittancesApi.clientDocument(selected.id, download);
    if (!response.ok) {
      previewWindow?.close();
      setError("No fue posible generar el PDF seguro para el cliente.");
      return;
    }
    const url = URL.createObjectURL(response.data);
    if (download) {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${selected.number ?? "remision"}.pdf`;
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
          <span className="rm-eyebrow">Facturación</span>
          <h1>Facturación de remisiones</h1>
          <p>Cola separada para codificar, revisar precios y preparar Siigo con control humano.</p>
        </div>
        <button type="button" className="rm-button secondary" onClick={load}>Actualizar cola</button>
      </header>

      <div className="rm-security-banner">
        <strong>Modo controlado.</strong> La consulta fiscal puede validarse contra Siigo, pero crear o timbrar la factura permanece bloqueado.
      </div>
      {error && <div className="rm-notice error" role="alert"><strong>No se completó la operación.</strong> {String(error)}</div>}
      {status === "stale" && <div className="rm-notice warning" role="status"><strong>Mostrando la última cola disponible.</strong> La actualización falló; no se ocultaron las remisiones.</div>}
      {status === "refreshing" && <div className="rm-progress" role="status"><span /> Actualizando cola…</div>}

      <div className="rm-toolbar">
        <label className="rm-search">Buscar remisión o cliente
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="RD-0001 o LAO KAO" />
        </label>
      </div>

      <div className="rm-accounting-layout">
        <div className="rm-queue" aria-label="Cola contable">
          {status === "loading" && <div className="rm-state">Cargando cola…</div>}
          {showsData && visible.length === 0 && <div className="rm-state">No hay remisiones para este filtro.</div>}
          {showsData && visible.map((item) => (
            <button type="button" className={`rm-queue-item${item.id === selectedId ? " selected" : ""}`} key={item.id} onClick={() => { setSelectedId(item.id); setPreview(null); setPreviewStatus("idle"); }}>
              <span><strong>{item.number ?? "Borrador"}</strong><small>{item.customer_detail.name} · NIT {item.customer_detail.nit}</small><small className={item.signature_status === "SIGNED" ? "rm-text-success" : "rm-text-warning"}>{item.signature_status === "SIGNED" ? `Firma OK · ${item.signed_by}` : "Firma pendiente"}</small></span>
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
                <span><small>Firma del cliente</small><strong>{selected.signature_status === "SIGNED" ? `Firma OK · ${selected.signed_by}` : "Pendiente"}</strong></span>
                {selected.signature_status !== "SIGNED" && <span><small>Recordatorio</small><button type="button" className="rm-button whatsapp" onClick={resendForSignature}>Reenviar para firmar</button>{localSignatureUrl && <a className="rm-link-button" href={localSignatureUrl} target="_blank" rel="noreferrer">Abrir firma local</a>}</span>}
                <span><small>Documento del cliente</small><span className="rm-inline-actions"><button type="button" className="rm-button secondary" onClick={() => openClientDocument(false)}>{selected.signature_status === "SIGNED" ? "Ver PDF firmado" : "Ver PDF"}</button><button type="button" className="rm-link-button" onClick={() => openClientDocument(true)}>Descargar</button></span></span>
              </div>
              <section className="rm-private-summary">
                <div className="rm-section-heading">
                  <div><span className="rm-eyebrow">Uso interno</span><h3>Factura del proveedor</h3></div>
                  <span className="rm-private-badge">Privada</span>
                </div>
                {selected.supplier_invoice_files?.length ? (
                  <div className="rm-attachments">
                    {selected.supplier_invoice_files.map((file) => (
                      <div key={file.id}>
                        <span><strong>{file.original_name}</strong><small>{Math.ceil(file.size_bytes / 1024)} KB · {file.mime_type}</small></span>
                        <button type="button" className="rm-button secondary" onClick={() => downloadSupplierInvoice(file)}>Descargar</button>
                      </div>
                    ))}
                  </div>
                ) : <p>No hay factura del proveedor adjunta.</p>}
                {privateDraft && (
                  <div className="rm-private-fields">
                    <label>Descuento global %<input type="number" min="0" max="100" step="0.0001" value={privateDraft.supplier_global_discount_percent} onChange={(event) => updatePrivateGlobal("supplier_global_discount_percent", event.target.value)} /></label>
                    <label>Descuento global valor<input type="number" min="0" step="0.01" value={privateDraft.supplier_global_discount_value} onChange={(event) => updatePrivateGlobal("supplier_global_discount_value", event.target.value)} /></label>
                    <label>Otros cargos<input type="number" min="0" step="0.01" value={privateDraft.supplier_other_charges} onChange={(event) => updatePrivateGlobal("supplier_other_charges", event.target.value)} /></label>
                    <label>Flete<input type="number" min="0" step="0.01" value={privateDraft.supplier_freight_cost} onChange={(event) => updatePrivateGlobal("supplier_freight_cost", event.target.value)} /></label>
                  </div>
                )}
              </section>
              {commercialDraft && (
                <section className="rm-commercial-preparation rm-commercial-preparation-top">
                  <div className="rm-section-heading">
                    <div><span className="rm-eyebrow">Preparación para Siigo</span><h3>Margen y productos de venta</h3></div>
                    <div className="rm-bulk-margin">
                      <label>Margen general %<input type="number" min="0" max="99.999" step="0.1" value={commercialDraft.default_margin_percent} onChange={(event) => { setCommercialDraft((current) => ({ ...current, default_margin_percent: event.target.value })); setCommercialSaveStatus("idle"); }} /></label>
                      <button type="button" className="rm-button secondary" onClick={applyMarginToAll}>Aplicar a todos</button>
                    </div>
                  </div>
                  <p>El precio de venta se calcula como costo neto ÷ (1 − margen). Aplica el porcentaje general y luego ajusta cualquier producto individualmente.</p>
                </section>
              )}
              <h3>Productos de la remisión</h3>
              <div className="rm-accounting-lines">
                {selected.lines.map((line) => {
                  const lineDraft = privateDraft?.lines.find((item) => item.id === line.id);
                  const commercialLine = commercialDraft?.lines.find((item) => item.id === line.id);
                  return (
                    <article key={line.id}>
                      <div className="rm-line-source"><strong>{line.quantity} × {line.original_description}</strong><small>Destino: {line.usage_destination || "SIN DEFINIR"}</small></div>
                      {lineDraft ? (
                        <div className="rm-supplier-reference rm-private-line-editor">
                          <small>Referencia privada del proveedor</small>
                          <label>SKU proveedor<input value={lineDraft.supplier_sku} onChange={(event) => updatePrivateLine(line.id, "supplier_sku", event.target.value.toUpperCase())} /></label>
                          <label>Costo unitario<input type="number" min="0" step="0.01" value={lineDraft.supplier_unit_cost} onChange={(event) => updatePrivateLine(line.id, "supplier_unit_cost", event.target.value)} /></label>
                          <label>Total renglón<input type="number" min="0" step="0.01" value={lineDraft.supplier_line_total} onChange={(event) => updatePrivateLine(line.id, "supplier_line_total", event.target.value)} /></label>
                          <label>Descuento %<input type="number" min="0" max="100" step="0.0001" value={lineDraft.supplier_discount_percent} onChange={(event) => updatePrivateLine(line.id, "supplier_discount_percent", event.target.value)} /></label>
                          <label>Descuento valor<input type="number" min="0" step="0.01" value={lineDraft.supplier_discount_value} onChange={(event) => updatePrivateLine(line.id, "supplier_discount_value", event.target.value)} /></label>
                        </div>
                      ) : <div className="rm-supplier-reference"><small>Referencia privada del proveedor</small><strong>{line.supplier_sku || "SIN SKU"}</strong></div>}
                      {commercialLine && (
                        <div className="rm-commercial-line-editor">
                          <small>Preparación de factura</small>
                          <div className="rm-sku-current">
                            <span><strong>{commercialLine.siigo_sku || "SKU Siigo pendiente"}</strong><small>{commercialLine.siigo_name || "Selecciona un producto existente de Siigo"}</small></span>
                            <button type="button" className="rm-button secondary" onClick={() => openSkuSearch(line)}>Buscar y vincular</button>
                          </div>
                          <label>Descripción para factura<input value={commercialLine.invoice_description} onChange={(event) => updateCommercialLine(line.id, "invoice_description", event.target.value.toUpperCase())} /></label>
                          <div className="rm-commercial-numbers">
                            <label>Margen %<input type="number" min="0" max="99.999" step="0.1" value={commercialLine.invoice_margin_percent} onChange={(event) => updateCommercialLine(line.id, "invoice_margin_percent", event.target.value)} /></label>
                            <span><small>Precio calculado</small><strong>{formatMoney(line.invoice_unit_price)}</strong></span>
                          </div>
                          <label>Motivo del ajuste (opcional)<input value={commercialLine.override_reason} onChange={(event) => updateCommercialLine(line.id, "override_reason", event.target.value)} /></label>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              <div className="rm-private-save-actions">
                <button type="button" className="rm-button secondary" onClick={savePrivateAdjustments} disabled={privateSaveStatus === "saving" || !privateDraft}>
                  {privateSaveStatus === "saving" ? "Guardando ajustes…" : "Guardar ajustes privados"}
                </button>
                {privateSaveStatus === "saved" && <span className="rm-text-success" role="status">Ajustes privados guardados.</span>}
              </div>
              {commercialDraft && (
                <section className="rm-commercial-save">
                  <button type="button" className="rm-button primary" onClick={saveCommercialPreparation} disabled={commercialSaveStatus === "saving"}>
                    {commercialSaveStatus === "saving" ? "Calculando…" : "Calcular y guardar preparación"}
                  </button>
                  {commercialSaveStatus === "saved" && <span className="rm-text-success" role="status">Preparación guardada. Revisa los precios calculados.</span>}
                </section>
              )}
              <div className="rm-invoice-actions">
                <button type="button" className="rm-button primary" onClick={requestPreview} disabled={previewStatus === "loading"}>
                  {previewStatus === "loading" ? "Validando…" : "Generar vista previa"}
                </button>
                <button type="button" className="rm-button secondary" onClick={requestSiigoPreflight} disabled={siigoPreflightStatus === "loading"}>
                  {siigoPreflightStatus === "loading" ? "Consultando Siigo…" : "Validar cliente e impuestos en Siigo"}
                </button>
                <span>Esta validación es de solo lectura: no crea factura ni envía a la DIAN.</span>
              </div>
              {preview && (
                <section className="rm-preview">
                  <div><span className="rm-eyebrow">Vista previa</span><h3>{preview.remittance_number}</h3></div>
                  {preview.items.map((item) => <p key={item.line_number}>{item.quantity} × {item.description} <strong>{formatMoney(item.total)}</strong></p>)}
                  <div className="rm-preview-total"><span>Subtotal</span><strong>{formatMoney(preview.subtotal)}</strong></div>
                  <div className="rm-fiscal-checks">
                    <span><small>Cliente</small><strong>{preview.customer.name} · {preview.customer.nit}</strong></span>
                    <span><small>Pago</small><strong>Crédito · {preview.customer_policy?.payment_days ?? 15} días</strong></span>
                    <span><small>Retenciones requeridas</small><strong>{preview.customer_policy?.retentions?.map((item) => item.label).join(" · ") || "Pendiente de validar"}</strong></span>
                    <span><small>Idempotencia</small><strong>{preview.idempotency_key || "Pendiente de generar"}</strong></span>
                  </div>
                  {preview.siigo_preflight?.status !== "READY_FOR_CONTROLLED_DRAFT" && <div className="rm-notice warning"><strong>Pendiente.</strong> {preview.siigo_preflight?.detail || "Actualiza la vista previa fiscal."}</div>}
                </section>
              )}
              {siigoPreflight && (
                <section className="rm-preview rm-siigo-preflight">
                  <div><span className="rm-eyebrow">Siigo validado · solo lectura</span><h3>{siigoPreflight.customer.name}</h3></div>
                  <div className="rm-fiscal-checks">
                    <span><small>Documento</small><strong>{siigoPreflight.document.name || siigoPreflight.document.prefix} · {siigoPreflight.document.prefix}</strong></span>
                    <span><small>Vendedor</small><strong>{siigoPreflight.customer.seller_id}</strong></span>
                    <span><small>Medio de pago</small><strong>{siigoPreflight.payment.name} · vence {siigoPreflight.payment.due_date}</strong></span>
                    <span><small>Responsabilidades fiscales</small><strong>{siigoPreflight.customer.fiscal_responsibilities.map((item) => item.name || item.code).join(" · ") || "Sin datos"}</strong></span>
                    <span><small>IVA</small><strong>{formatMoney(siigoPreflight.summary.tax_total)}</strong></span>
                    <span><small>Retenciones</small><strong>{siigoPreflight.retentions.map((item) => item.label).join(" · ")}</strong></span>
                  </div>
                  <div className="rm-preview-total"><span>Total antes de retenciones</span><strong>{formatMoney(siigoPreflight.summary.gross_total)}</strong></div>
                  <div className="rm-preview-total"><span>Retenciones</span><strong>− {formatMoney(siigoPreflight.summary.retentions_total)}</strong></div>
                  <div className="rm-preview-total"><span>Total a pagar</span><strong>{formatMoney(siigoPreflight.summary.payment_total)}</strong></div>
                  <div className="rm-notice success"><strong>Preliquidación lista.</strong> externalWrites=0 · stamp=false · mail=false. Aún no existe factura en Siigo ni envío a DIAN.</div>
                  <div className="rm-draft-confirmation">
                    <label>
                      <input type="checkbox" checked={draftConfirmed} onChange={(event) => setDraftConfirmed(event.target.checked)} />
                      Confirmo crear un borrador real en Siigo, sin enviarlo a la DIAN ni por correo.
                    </label>
                    <button type="button" className="rm-button primary" onClick={createSiigoDraft} disabled={!draftConfirmed || draftCreateStatus === "loading"}>
                      {draftCreateStatus === "loading" ? "Creando borrador…" : "Crear borrador de prueba en Siigo"}
                    </button>
                    <small>La cuenta local mantiene esta acción bloqueada hasta activar simultáneamente las dos llaves de escritura.</small>
                  </div>
                  {draftResult && <div className="rm-notice success"><strong>Borrador creado.</strong> {draftResult.external_number} · DIAN: no · correo: no.</div>}
                </section>
              )}
            </>
          )}
        </aside>
      </div>
      {skuDialog && (
        <div className="rm-overlay rm-nested-overlay" role="presentation">
          <section className="rm-dialog rm-sku-dialog" role="dialog" aria-modal="true" aria-labelledby="siigo-search-title">
            <div className="rm-dialog-head">
              <div><span className="rm-eyebrow">Catálogo Siigo</span><h2 id="siigo-search-title">Buscar y vincular SKU</h2><p>Consulta de solo lectura sobre el último catálogo Siigo guardado. La selección siempre es humana.</p></div>
              <button type="button" className="rm-link-button" onClick={() => setSkuDialog(null)}>Cerrar</button>
            </div>
            <div className="rm-form">
              <div className="rm-sku-search-row">
                <label>SKU o nombre<input autoFocus value={skuDialog.query} onChange={(event) => setSkuDialog((current) => ({ ...current, query: event.target.value, error: "" }))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); searchSiigo(); } }} /></label>
                <button type="button" className="rm-button primary" onClick={searchSiigo} disabled={skuDialog.status === "loading"}>{skuDialog.status === "loading" ? "Buscando…" : "Buscar"}</button>
              </div>
              {skuDialog.error && <div className="rm-notice error" role="alert">{skuDialog.error}</div>}
              {skuDialog.status === "ready" && skuDialog.results.length === 0 && <div className="rm-state">No hay coincidencias en el catálogo local activo de Siigo.</div>}
              <div className="rm-sku-results">
                {skuDialog.results.map((product) => (
                  <button type="button" key={product.siigo_id || product.sku} onClick={() => selectSiigoProduct(product)}>
                    <span><strong>{product.sku}</strong><small>{product.name}</small></span>
                    <span><small>Precio Siigo</small><strong>{formatMoney(product.sale_price)}</strong></span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
