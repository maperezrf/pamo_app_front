import { useCallback, useEffect, useState } from "react";
import { communicationsApi } from "./api";


const emptyConfig = {
  provider: "meta_cloud_api",
  partnerName: "",
  displayName: "",
  businessId: "",
  wabaId: "",
  phoneNumberId: "",
  displayPhoneNumber: "",
  connectionState: "not_linked",
  qualityRating: "unknown",
  webhookState: "not_configured",
  active: false,
};


const stateLabels = {
  not_linked: "Sin vincular",
  observed: "Observado en Meta",
  ready: "Listo",
  blocked: "Bloqueado",
};


export default function WhatsAppSettings() {
  const [form, setForm] = useState(emptyConfig);
  const [capabilities, setCapabilities] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSuccessAt, setLastSuccessAt] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [settings, readiness] = await Promise.all([
        communicationsApi.settings(),
        communicationsApi.capabilities(),
      ]);
      setForm({ ...emptyConfig, ...(settings.config || {}) });
      setCapabilities(readiness);
      setLastSuccessAt(new Date().toLocaleString("es-CO"));
      setStale(false);
    } catch (reason) {
      setStale(true);
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const save = async (event) => {
    event.preventDefault();
    if (stale) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload = await communicationsApi.saveSettings(form);
      setForm({ ...emptyConfig, ...(payload.config || {}) });
      setLastSuccessAt(new Date().toLocaleString("es-CO"));
      setNotice("Configuración guardada únicamente en local. Meta no fue modificado.");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  };

  const gates = capabilities?.gates || {};

  return (
    <main className="whatsapp-settings-page">
      <header className="whatsapp-settings-heading">
        <div>
          <span className="eyebrow">INTEGRACIONES</span>
          <h1>WhatsApp</h1>
          <p>Vinculación local independiente para futuros módulos de PAMO APP.</p>
        </div>
        <span className="local-safety-pill">externalWrites: 0</span>
      </header>

      {stale && (
        <section className="whatsapp-alert warning" role="alert">
          <div>
            <strong>La vista puede estar desactualizada.</strong>
            <span>Última actualización correcta: {lastSuccessAt || "sin registro"}</span>
          </div>
          <button type="button" className="secondary-action" onClick={load}>Reintentar</button>
        </section>
      )}
      {error && <p className="whatsapp-alert error" role="alert">{error}</p>}
      {notice && <p className="whatsapp-alert success" role="status">{notice}</p>}

      <section className="whatsapp-status-grid">
        <article>
          <span>Estado</span>
          <strong>{stateLabels[form.connectionState] || form.connectionState}</strong>
        </article>
        <article>
          <span>Proveedor local</span>
          <strong>{capabilities?.mockMode ? "Mock seguro" : "Meta Cloud API"}</strong>
        </article>
        <article>
          <span>Webhook</span>
          <strong>{form.webhookState === "verified" ? "Verificado" : "Sin activar"}</strong>
        </article>
        <article>
          <span>Calidad</span>
          <strong>{form.qualityRating === "high" ? "Alta" : "Sin datos"}</strong>
        </article>
      </section>

      <form className="whatsapp-settings-card" onSubmit={save}>
        <header>
          <div>
            <h2>Configuración básica</h2>
            <p>Solo almacena identificadores y estado. Los secretos nunca se ingresan aquí.</p>
          </div>
          <span>{loading ? "Cargando…" : "Local"}</span>
        </header>

        <div className="whatsapp-settings-fields">
          <label>
            Cuenta o socio
            <input value={form.partnerName} onChange={(event) => update("partnerName", event.target.value)} placeholder="Ej. VAMBE" />
          </label>
          <label>
            Nombre visible
            <input value={form.displayName} onChange={(event) => update("displayName", event.target.value)} placeholder="Ej. Pamo Colombia" />
          </label>
          <label>
            Número visible
            <input value={form.displayPhoneNumber} onChange={(event) => update("displayPhoneNumber", event.target.value)} placeholder="+57…" />
          </label>
          <label>
            Business ID
            <input inputMode="numeric" value={form.businessId} onChange={(event) => update("businessId", event.target.value)} />
          </label>
          <label>
            WABA ID
            <input inputMode="numeric" value={form.wabaId} onChange={(event) => update("wabaId", event.target.value)} />
          </label>
          <label>
            Phone number ID
            <input inputMode="numeric" value={form.phoneNumberId} onChange={(event) => update("phoneNumberId", event.target.value)} />
          </label>
        </div>

        <div className="whatsapp-settings-controls">
          <label>
            Estado local
            <select value={form.connectionState} onChange={(event) => update("connectionState", event.target.value)}>
              <option value="not_linked">Sin vincular</option>
              <option value="observed">Observado en Meta</option>
              <option value="blocked">Bloqueado</option>
            </select>
          </label>
          <button type="submit" className="primary-action" disabled={loading || saving || stale}>
            {saving ? "Guardando…" : "Guardar configuración local"}
          </button>
          <button type="button" className="secondary-action" disabled title="Requiere autorización antes de modificar Meta">
            Vincular con Meta · siguiente fase
          </button>
        </div>
      </form>

      <section className="whatsapp-gates-card">
        <div>
          <h2>Protecciones de salida</h2>
          <p>Las tres puertas deben estar activas para un envío real.</p>
        </div>
        <ul>
          <li><span>Escrituras globales</span><b>{gates.global ? "Activa" : "Apagada"}</b></li>
          <li><span>Mensajería externa</span><b>{gates.messaging ? "Activa" : "Apagada"}</b></li>
          <li><span>WhatsApp</span><b>{gates.whatsapp ? "Activa" : "Apagada"}</b></li>
        </ul>
      </section>
    </main>
  );
}
