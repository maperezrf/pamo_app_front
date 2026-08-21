import { useMemo, useState } from "react";

const initialForm = {
  warehouse: "",
  supplier: "",
  customer: "",
  requesterName: "",
  requesterDocument: "",
  quantity: "1",
  description: "",
  destination: "",
  deliveryMethod: "PERSONAL_PICKUP",
};

export default function RemittanceCreatePanel({ referenceData, onClose, onCreate, submitting }) {
  const [form, setForm] = useState(() => ({
    ...initialForm,
    warehouse: String(referenceData.warehouses.find((item) => item.is_default)?.id ?? ""),
    supplier: String(referenceData.favorites.find((item) => item.party.party_type === "SUPPLIER")?.party.id ?? ""),
    customer: String(referenceData.favorites.find((item) => item.party.party_type === "CUSTOMER")?.party.id ?? ""),
  }));

  const suppliers = useMemo(
    () => referenceData.favorites.filter((item) => item.party.party_type === "SUPPLIER"),
    [referenceData],
  );
  const customers = useMemo(
    () => referenceData.favorites.filter((item) => item.party.party_type === "CUSTOMER"),
    [referenceData],
  );

  const update = (field, value, uppercase = false) => {
    setForm((current) => ({ ...current, [field]: uppercase ? value.toUpperCase() : value }));
  };

  const valid = form.warehouse && form.supplier && form.customer && form.requesterName.trim()
    && Number(form.quantity) > 0 && form.description.trim();

  const submit = (event) => {
    event.preventDefault();
    if (!valid) return;
    onCreate({
      warehouse: Number(form.warehouse),
      supplier: Number(form.supplier),
      customer: Number(form.customer),
      requester_name: form.requesterName,
      requester_document: form.requesterDocument,
      lines: [{
        quantity: Number(form.quantity).toFixed(3),
        original_description: form.description,
        usage_destination: form.destination,
      }],
      delivery: { method: form.deliveryMethod, notes: "" },
    });
  };

  return (
    <div className="rm-overlay" role="presentation">
      <section className="rm-dialog" role="dialog" aria-modal="true" aria-labelledby="new-remittance-title">
        <div className="rm-dialog-head">
          <div>
            <span className="rm-eyebrow">Ventas</span>
            <h2 id="new-remittance-title">Nueva remisión</h2>
            <p>Borrador controlado. La firma puede completarse después.</p>
          </div>
          <button type="button" className="rm-link-button" onClick={onClose}>Cerrar</button>
        </div>
        <form className="rm-form" onSubmit={submit}>
          <label>Bodega
            <select value={form.warehouse} onChange={(event) => update("warehouse", event.target.value)} required>
              <option value="">Selecciona</option>
              {referenceData.warehouses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Proveedor favorito
            <select value={form.supplier} onChange={(event) => update("supplier", event.target.value)} required>
              <option value="">Selecciona</option>
              {suppliers.map(({ party }) => <option key={party.id} value={party.id}>{party.name} · {party.nit}</option>)}
            </select>
          </label>
          <label>Cliente favorito
            <select value={form.customer} onChange={(event) => update("customer", event.target.value)} required>
              <option value="">Selecciona</option>
              {customers.map(({ party }) => <option key={party.id} value={party.id}>{party.name} · {party.nit}</option>)}
            </select>
          </label>
          <div className="rm-form-grid">
            <label>Persona autorizada / solicitante
              <input value={form.requesterName} onChange={(event) => update("requesterName", event.target.value, true)} placeholder="ARLEY" required />
            </label>
            <label>Documento (opcional)
              <input value={form.requesterDocument} onChange={(event) => update("requesterDocument", event.target.value)} />
            </label>
          </div>
          <div className="rm-line-editor">
            <div className="rm-form-grid rm-form-grid-line">
              <label>Cantidad
                <input type="number" min="0.001" step="0.001" inputMode="decimal" value={form.quantity} onChange={(event) => update("quantity", event.target.value)} required />
              </label>
              <label>Descripción original
                <input value={form.description} onChange={(event) => update("description", event.target.value, true)} required />
              </label>
            </div>
            <label>Destino de uso (opcional)
              <input value={form.destination} onChange={(event) => update("destination", event.target.value, true)} placeholder="CALLE 80" />
            </label>
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
          <div className="rm-dialog-actions">
            <button type="button" className="rm-button secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="rm-button primary" disabled={!valid || submitting}>
              {submitting ? "Guardando…" : "Guardar borrador"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
