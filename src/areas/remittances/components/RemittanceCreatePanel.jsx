import { useMemo, useState } from "react";
import { remittancesApi } from "../api";

const blankLine = () => ({
  localId: `${Date.now()}-${Math.random()}`,
  quantity: "1",
  description: "",
  destination: "",
  supplierSku: "",
  supplierUnitCost: "",
  supplierLineTotal: "",
  supplierDiscountPercent: "",
  supplierDiscountValue: "",
  warning: "",
});

const initialForm = {
  warehouse: "",
  supplier: "",
  customer: "",
  requesterName: "",
  requesterDocument: "",
  deliveryMethod: "PERSONAL_PICKUP",
  globalDiscountPercent: "",
  globalDiscountValue: "",
  otherCharges: "",
  freightCost: "",
};

function privateNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function parseError(response) {
  return response.data?.detail ?? "No fue posible interpretar la factura. Puedes continuar manualmente.";
}

export default function RemittanceCreatePanel({ referenceData, onClose, onCreate, submitting }) {
  const [form, setForm] = useState(() => ({
    ...initialForm,
    warehouse: String(referenceData.warehouses.find((item) => item.is_default)?.id ?? ""),
    supplier: String(referenceData.favorites.find((item) => item.party.party_type === "SUPPLIER")?.party.id ?? ""),
    customer: String(referenceData.favorites.find((item) => item.party.party_type === "CUSTOMER")?.party.id ?? ""),
  }));
  const [captureMode, setCaptureMode] = useState("manual");
  const [lines, setLines] = useState([blankLine()]);
  const [pendingFile, setPendingFile] = useState(null);
  const [processing, setProcessing] = useState("idle");
  const [captureError, setCaptureError] = useState("");
  const [invoiceWarnings, setInvoiceWarnings] = useState([]);
  const [supplierSearchOpen, setSupplierSearchOpen] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierResults, setSupplierResults] = useState([]);
  const [supplierSearchState, setSupplierSearchState] = useState("idle");
  const [supplierSearchMessage, setSupplierSearchMessage] = useState("");
  const [selectedExternalSupplier, setSelectedExternalSupplier] = useState(null);

  const suppliers = useMemo(
    () => referenceData.favorites.filter((item) => item.party.party_type === "SUPPLIER"),
    [referenceData],
  );
  const customers = useMemo(
    () => referenceData.favorites.filter((item) => item.party.party_type === "CUSTOMER"),
    [referenceData],
  );
  const selectedCustomerId = Number(form.customer);
  const authorizedPeople = useMemo(
    () => (referenceData.authorized_people ?? []).filter(
      (item) => Number(item.customer) === selectedCustomerId,
    ),
    [referenceData, selectedCustomerId],
  );
  const usageDestinations = useMemo(
    () => (referenceData.usage_destinations ?? []).filter(
      (item) => Number(item.customer) === selectedCustomerId,
    ),
    [referenceData, selectedCustomerId],
  );
  const destinationListId = `rm-destinations-${selectedCustomerId || "none"}`;

  const update = (field, value, uppercase = false) => {
    setForm((current) => ({ ...current, [field]: uppercase ? value.toUpperCase() : value }));
  };
  const updateLine = (id, field, value, uppercase = false) => {
    setLines((current) => current.map((line) => line.localId === id
      ? { ...line, [field]: uppercase ? value.toUpperCase() : value }
      : line));
  };
  const updateRequester = (value) => {
    const normalized = value.toUpperCase();
    const known = authorizedPeople.find((item) => item.name === normalized);
    setForm((current) => ({
      ...current,
      requesterName: normalized,
      requesterDocument: known?.document || "",
    }));
  };
  const selectRequester = (id) => {
    const known = authorizedPeople.find((item) => String(item.id) === String(id));
    setForm((current) => ({
      ...current,
      requesterName: known?.name || "",
      requesterDocument: known?.document || "",
    }));
  };
  const selectedRequesterId = authorizedPeople.find(
    (item) => item.name === form.requesterName,
  )?.id ?? "";

  const searchSuppliers = async () => {
    const query = supplierQuery.trim();
    if (query.length < 2) {
      setSupplierSearchMessage("Escribe al menos 2 caracteres o el NIT completo.");
      setSupplierResults([]);
      return;
    }
    setSupplierSearchState("loading");
    setSupplierSearchMessage("");
    const response = await remittancesApi.searchSuppliers(query);
    if (!response.ok) {
      setSupplierSearchState("error");
      setSupplierResults(response.data?.results ?? []);
      setSupplierSearchMessage(response.data?.detail ?? "No fue posible buscar proveedores.");
      return;
    }
    setSupplierSearchState("ready");
    setSupplierResults(response.data.results ?? []);
    if (!(response.data.results ?? []).length) {
      if (response.data.live_lookup === "DISABLED") {
        setSupplierSearchMessage("No está guardado localmente. Para consultar ese NIT en Siigo debe activarse la lectura segura del entorno.");
      } else if (response.data.live_lookup === "NOT_FOUND") {
        setSupplierSearchMessage("Siigo no encontró un proveedor principal activo con ese NIT.");
      } else {
        setSupplierSearchMessage("No se encontró por nombre entre los proveedores ya guardados. Prueba con el NIT completo para consultar Siigo.");
      }
    }
  };

  const chooseSupplier = async (supplier) => {
    if (!supplier.requires_import) {
      const isFavorite = suppliers.some(({ party }) => Number(party.id) === Number(supplier.id));
      update("supplier", String(supplier.id));
      setSelectedExternalSupplier(isFavorite ? null : supplier);
      setSupplierSearchOpen(false);
      return;
    }
    setSupplierSearchState("confirming");
    setSupplierSearchMessage("");
    const response = await remittancesApi.confirmSiigoSupplier(supplier.nit);
    if (!response.ok) {
      setSupplierSearchState("error");
      setSupplierSearchMessage(response.data?.detail ?? "No se pudo confirmar el proveedor en Siigo.");
      return;
    }
    setSelectedExternalSupplier(response.data);
    update("supplier", String(response.data.id));
    setSupplierSearchState("ready");
    setSupplierSearchOpen(false);
  };

  const processInvoice = async (file) => {
    if (!file) return;
    setPendingFile(file);
    setCaptureError("");
    setInvoiceWarnings([]);
    setProcessing("uploading");
    const response = await remittancesApi.interpretSupplierInvoice(file);
    if (!response.ok) {
      setCaptureError(parseError(response));
      setProcessing("error");
      return;
    }
    const parsed = response.data.data;
    setLines(parsed.lines.map((line) => ({
      localId: `${Date.now()}-${Math.random()}`,
      quantity: String(line.quantity),
      description: line.description,
      destination: "",
      supplierSku: line.supplier_sku ?? "",
      supplierUnitCost: line.supplier_unit_cost ?? "",
      supplierLineTotal: line.supplier_line_total ?? "",
      supplierDiscountPercent: line.supplier_discount_percent ?? "",
      supplierDiscountValue: line.supplier_discount_value ?? "",
      warning: line.warning ?? "",
    })));
    setForm((current) => ({
      ...current,
      globalDiscountPercent: parsed.global_discount_percent ?? "",
      globalDiscountValue: parsed.global_discount_value ?? "",
      otherCharges: parsed.other_charges ?? "",
      freightCost: parsed.freight_cost ?? "",
    }));
    setInvoiceWarnings(parsed.warnings ?? []);
    setProcessing("ready");
  };

  const missingFields = useMemo(() => {
    const missing = [];
    if (!form.warehouse) missing.push("Bodega");
    if (!form.supplier) missing.push("Proveedor");
    if (!form.customer) missing.push("Cliente");
    if (!form.requesterName.trim()) missing.push("Persona autorizada / solicitante");
    if (!lines.length) missing.push("Al menos un producto");
    lines.forEach((line, index) => {
      if (!(Number(line.quantity) > 0)) missing.push(`Cantidad del producto ${index + 1}`);
      if (!line.description.trim()) missing.push(`Descripción del producto ${index + 1}`);
    });
    return missing;
  }, [form.customer, form.requesterName, form.supplier, form.warehouse, lines]);
  const valid = missingFields.length === 0;
  const busy = submitting || processing === "uploading";

  const submit = (event) => {
    event.preventDefault();
    if (!valid || busy) return;
    onCreate({
      warehouse: Number(form.warehouse),
      supplier: Number(form.supplier),
      customer: Number(form.customer),
      requester_name: form.requesterName,
      requester_document: form.requesterDocument,
      supplier_global_discount_percent: privateNumber(form.globalDiscountPercent),
      supplier_global_discount_value: privateNumber(form.globalDiscountValue),
      supplier_other_charges: privateNumber(form.otherCharges),
      supplier_freight_cost: privateNumber(form.freightCost),
      lines: lines.map((line) => ({
        quantity: Number(line.quantity).toFixed(3),
        original_description: line.description,
        usage_destination: line.destination,
        supplier_sku: line.supplierSku,
        supplier_unit_cost: privateNumber(line.supplierUnitCost),
        supplier_line_total: privateNumber(line.supplierLineTotal),
        supplier_discount_percent: privateNumber(line.supplierDiscountPercent),
        supplier_discount_value: privateNumber(line.supplierDiscountValue),
      })),
      delivery: { method: form.deliveryMethod, notes: "" },
    }, pendingFile);
  };

  return (
    <div className="rm-overlay" role="presentation">
      <section className="rm-dialog rm-dialog-wide" role="dialog" aria-modal="true" aria-labelledby="new-remittance-title">
        <div className="rm-dialog-head">
          <div>
            <span className="rm-eyebrow">Ventas</span>
            <h2 id="new-remittance-title">Nueva remisión</h2>
            <p>La factura del proveedor es privada. SKU y costos nunca aparecen en la remisión del cliente.</p>
          </div>
          <button type="button" className="rm-link-button" onClick={onClose}>Cerrar</button>
        </div>
        <form className="rm-form" onSubmit={submit}>
          <div className="rm-form-grid rm-party-grid">
            <label>Bodega
              <select value={form.warehouse} onChange={(event) => update("warehouse", event.target.value)} required>
                <option value="">Selecciona</option>
                {referenceData.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Proveedor
              <select value={form.supplier} onChange={(event) => { update("supplier", event.target.value); setSelectedExternalSupplier(null); }} required>
                <option value="">Selecciona</option>
                {selectedExternalSupplier && (
                  <option value={selectedExternalSupplier.id}>{selectedExternalSupplier.name} · {selectedExternalSupplier.nit}</option>
                )}
                {suppliers.map(({ party }) => <option key={party.id} value={party.id}>{party.name} · {party.nit}</option>)}
              </select>
              <button
                type="button"
                className="rm-inline-search-toggle"
                onClick={() => setSupplierSearchOpen((current) => !current)}
                aria-expanded={supplierSearchOpen}
              >
                {supplierSearchOpen ? "Cerrar búsqueda" : "Buscar otro proveedor"}
              </button>
              <small>Los favoritos aparecen arriba. También puedes buscar por nombre guardado o por NIT exacto en Siigo.</small>
            </label>
          </div>
          {supplierSearchOpen && (
            <section className="rm-party-search" aria-label="Buscar proveedor">
              <div className="rm-party-search-row">
                <label>Nombre o NIT del proveedor
                  <input
                    value={supplierQuery}
                    onChange={(event) => setSupplierQuery(event.target.value.toUpperCase())}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        searchSuppliers();
                      }
                    }}
                    placeholder="EJ. GRIFOCOL O 900918689"
                    autoComplete="off"
                  />
                </label>
                <button type="button" className="rm-button secondary" onClick={searchSuppliers} disabled={supplierSearchState === "loading" || supplierSearchState === "confirming"}>
                  {supplierSearchState === "loading" ? "Buscando…" : "Buscar"}
                </button>
              </div>
              {supplierSearchMessage && <div className={`rm-notice ${supplierSearchState === "error" ? "error" : "warning"}`} role="status">{supplierSearchMessage}</div>}
              {supplierResults.length > 0 && (
                <div className="rm-party-results" aria-label="Resultados de proveedores">
                  {supplierResults.map((supplier) => (
                    <button type="button" key={`${supplier.source}-${supplier.id ?? supplier.siigo_id}`} onClick={() => chooseSupplier(supplier)} disabled={supplierSearchState === "confirming"}>
                      <span><strong>{supplier.name}</strong><small>NIT {supplier.nit}</small></span>
                      <span>{supplier.requires_import ? "Confirmar en Siigo" : "Seleccionar"}</span>
                    </button>
                  ))}
                </div>
              )}
              <small>La búsqueda no crea ni modifica proveedores en Siigo. Si el NIT existe allí, solo guarda localmente la referencia validada al seleccionarlo.</small>
            </section>
          )}
          <div className="rm-form-grid rm-party-grid">
            <label>Cliente favorito
              <select value={form.customer} onChange={(event) => update("customer", event.target.value)} required>
                <option value="">Selecciona</option>
                {customers.map(({ party }) => <option key={party.id} value={party.id}>{party.name} · {party.nit}</option>)}
              </select>
            </label>
            <label>Persona autorizada / solicitante
              <select value={selectedRequesterId} onChange={(event) => selectRequester(event.target.value)}>
                <option value="">Escribir un nombre nuevo</option>
                {authorizedPeople.map((item) => <option key={item.id} value={item.id}>{item.name}{item.document ? ` · ${item.document}` : ""}</option>)}
              </select>
              <input
                value={form.requesterName}
                onChange={(event) => updateRequester(event.target.value)}
                placeholder="NOMBRE DE QUIEN RETIRA O SOLICITA"
                autoComplete="off"
                required
              />
              <small>{selectedRequesterId ? "Persona frecuente seleccionada. Puedes cambiarla o escribir otro nombre." : "Escribe un nombre nuevo; se guardará en mayúsculas para este cliente al crear la remisión."}</small>
              {authorizedPeople.length > 0 && (
                <div className="rm-frequent-options" aria-label="Personas frecuentes de este cliente">
                  <span>Frecuentes:</span>
                  {authorizedPeople.map((item) => (
                    <button type="button" key={item.id} className={item.name === form.requesterName ? "selected" : ""} aria-pressed={item.name === form.requesterName} onClick={() => selectRequester(item.id)}>
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </label>
          </div>
          <label>Documento (opcional)
            <input value={form.requesterDocument} onChange={(event) => update("requesterDocument", event.target.value)} />
          </label>

          <section className="rm-capture-section" aria-labelledby="capture-title">
            <div className="rm-section-heading">
              <div><span className="rm-eyebrow">Captura de productos</span><h3 id="capture-title">¿Cómo quieres cargar la mercancía?</h3></div>
              {pendingFile && <span className="rm-file-chip">{pendingFile.name}</span>}
            </div>
            <div className="rm-mode-tabs" role="tablist" aria-label="Modo de captura">
              <button type="button" role="tab" aria-selected={captureMode === "manual"} className={captureMode === "manual" ? "selected" : ""} onClick={() => setCaptureMode("manual")}>Manual</button>
              <button type="button" role="tab" aria-selected={captureMode === "invoice"} className={captureMode === "invoice" ? "selected" : ""} onClick={() => setCaptureMode("invoice")}>Factura del proveedor</button>
            </div>
            {captureMode === "invoice" && (
              <div className="rm-private-upload">
                <div>
                  <strong>Adjuntar y leer factura privada</strong>
                  <p>PDF, JPG, PNG, WebP o Excel. Máximo 12 MB. La lectura genera un borrador editable.</p>
                </div>
                <div className="rm-upload-actions">
                  <label className="rm-button secondary rm-file-button">Elegir archivo
                    <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.xlsx,.xls" onChange={(event) => processInvoice(event.target.files?.[0])} />
                  </label>
                  <label className="rm-button secondary rm-file-button">Tomar foto
                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(event) => processInvoice(event.target.files?.[0])} />
                  </label>
                </div>
                {processing === "uploading" && <div className="rm-progress" role="status"><span /> Procesando factura del proveedor…</div>}
                {processing === "ready" && <div className="rm-notice success" role="status"><strong>Lectura completada.</strong> Revisa cantidades y descripciones. SKU, costos y descuentos quedan privados para Facturación.</div>}
                {captureError && <div className="rm-notice error" role="alert"><strong>No se interpretó automáticamente.</strong> {captureError} El archivo puede conservarse y los productos corregirse manualmente.</div>}
                {invoiceWarnings.map((warning, index) => <div className="rm-notice warning" key={`${warning}-${index}`}>{warning}</div>)}
              </div>
            )}
          </section>

          <div className="rm-lines-heading">
            <h3>Borrador de productos</h3>
            <button type="button" className="rm-link-button" onClick={() => setLines((current) => [...current, blankLine()])}>+ Agregar producto</button>
          </div>
          <div className="rm-editable-lines">
            {lines.map((line, index) => (
              <article className="rm-line-editor" key={line.localId}>
                <div className="rm-line-title"><strong>Producto {index + 1}</strong>{lines.length > 1 && <button type="button" className="rm-link-button danger" onClick={() => setLines((current) => current.filter((item) => item.localId !== line.localId))}>Eliminar</button>}</div>
                <div className="rm-form-grid rm-form-grid-line">
                  <label>Cantidad
                    <input type="number" min="0.001" step="0.001" inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(line.localId, "quantity", event.target.value)} required />
                  </label>
                  <label>Descripción original
                    <input value={line.description} onChange={(event) => updateLine(line.localId, "description", event.target.value, true)} required />
                  </label>
                </div>
                <label>Destino de uso (opcional)
                  <input
                    list={destinationListId}
                    value={line.destination}
                    onChange={(event) => updateLine(line.localId, "destination", event.target.value, true)}
                    placeholder="SELECCIONA O ESCRIBE UN DESTINO"
                    autoComplete="off"
                  />
                  <datalist id={destinationListId}>
                    {usageDestinations.map((item) => <option key={item.id} value={item.value} />)}
                  </datalist>
                  <small>El destino nuevo quedará disponible para el operario y para la firma del cliente.</small>
                  {usageDestinations.length > 0 && (
                    <div className="rm-frequent-options" aria-label="Destinos frecuentes de este cliente">
                      <span>Frecuentes:</span>
                      {usageDestinations.map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => updateLine(line.localId, "destination", item.value, true)}
                        >
                          {item.value}
                        </button>
                      ))}
                    </div>
                  )}
                </label>
                {line.warning && <div className="rm-line-warning">Revisar: {line.warning}</div>}
              </article>
            ))}
          </div>

          <label>Método de entrega
            <select value={form.deliveryMethod} onChange={(event) => update("deliveryMethod", event.target.value)}>
              <option value="PERSONAL_PICKUP">Retira personalmente</option>
              <option value="CARRIER">Transportadora</option>
              <option value="UBER">Uber</option>
              <option value="INDRIVE">InDrive</option>
              <option value="MESSENGER">Mensajería / domiciliario</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>
          <div className={`rm-required-summary${valid ? " complete" : ""}`} role="status" aria-live="polite">
            {valid ? (
              <><strong>Información mínima completa.</strong> Ya puedes guardar el borrador.</>
            ) : (
              <>
                <strong>Falta completar para continuar:</strong>
                <ul>{missingFields.map((field) => <li key={field}>{field}</li>)}</ul>
              </>
            )}
          </div>
          <div className="rm-dialog-actions">
            <button type="button" className="rm-button secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="rm-button primary" disabled={!valid || busy}>
              {submitting ? "Guardando…" : "Guardar borrador"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
