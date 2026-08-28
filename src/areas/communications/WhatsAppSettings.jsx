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
  const connectionTone = form.connectionState === "ready"
    ? "is-ready"
    : form.connectionState === "blocked"
      ? "is-blocked"
      : "is-pending";
  const lineType = capabilities?.mockMode
    ? "Número de prueba"
    : form.connectionState === "ready"
      ? "Número real verificado"
      : "Número real por verificar";

  return (
    <main className="whatsapp-settings-page">
      <header className={`whatsapp-settings-heading ${connectionTone}`}>
        <div>
          <span className="eyebrow">INTEGRACIONES</span>
          <h1>WhatsApp</h1>
          <p>Estado operativo y diagnóstico de la mensajería de Pedidos.</p>
        </div>
        <span className="whatsapp-connection-pill">
          {stateLabels[form.connectionState] || form.connectionState}
        </span>
      </header>

      {stale && (
        <section className="whatsapp-alert warning" role="alert">
          <div>
            <strong>La vista puede estar desactualizada.</strong>
            <span>Última conexión correcta: {lastSuccessAt || "sin registro"}</span>
          </div>
          <button type="button" className="secondary-action" onClick={load}>Reintentar</button>
        </section>
      )}
      {error && <p className="whatsapp-alert error" role="alert">{error}</p>}
      {notice && <p className="whatsapp-alert success" role="status">{notice}</p>}

      {form.connectionState === "blocked" && (
        <section className="whatsapp-alert error persistent" role="alert">
          <div>
            <strong>Conexión bloqueada.</strong>
            <span>El token anterior no se reintentará. Reemplázalo y valídalo fuera de esta pantalla.</span>
          </div>
        </section>
      )}

      <section className={`whatsapp-status-grid ${connectionTone}`} aria-label="Estado operativo">
        <article>
          <span>Conexión</span>
          <strong>{stateLabels[form.connectionState] || form.connectionState}</strong>
        </article>
        <article>
          <span>Modo de operación</span>
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
            <h2>Estado operativo</h2>
            <p>Datos visibles del canal. Los secretos nunca se ingresan aquí.</p>
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
            Simulación · no ejecuta cambios
          </button>
        </div>
      </form>

      <section className="whatsapp-profile-card">
        <header>
          <div>
            <h2>Perfil comercial de la línea</h2>
            <p>No se presenta el número de prueba de Meta como línea final.</p>
          </div>
          <b>{lineType}</b>
        </header>
        <div className="whatsapp-profile-grid">
          <div><span>Nombre aprobado</span><strong>{form.displayName || "Pendiente de aprobación"}</strong></div>
          <div><span>Número</span><strong>{form.displayPhoneNumber || capabilities?.pilotRecipientMasked || "Pendiente"}</strong></div>
          <div><span>Foto o logo</span><strong>Pendiente de Meta</strong></div>
          <div><span>Descripción</span><strong>Pendiente de Meta</strong></div>
          <div><span>Correo y sitio</span><strong>Pendiente de Meta</strong></div>
          <div><span>Verificación</span><strong>{form.connectionState === "ready" ? "Verificada" : "No verificada"}</strong></div>
        </div>
      </section>

      <section className="whatsapp-internal-card">
        <header>
          <div>
            <h2>Copias internas del piloto</h2>
            <p>Un resumen por pedido nuevo; nunca se mezclan con contactos de proveedores.</p>
          </div>
        </header>
        <div className="whatsapp-internal-list">
          {(capabilities?.internalRecipients || []).map((recipient) => (
            <div key={`${recipient.name}-${recipient.phoneMasked}`}>
              <span><strong>{recipient.name}</strong><small>{recipient.phoneMasked}</small></span>
              <b>{capabilities?.internalOrderNotificationsEnabled ? "Piloto habilitado" : "Configurado · apagado"}</b>
            </div>
          ))}
          {!capabilities?.internalRecipients?.length && <p>Sin destinatarios internos configurados.</p>}
        </div>
        <small>
          Inicio controlado: {capabilities?.internalCopyCheckpoint
            ? new Date(capabilities.internalCopyCheckpoint).toLocaleString("es-CO")
            : "pendiente; no se enviarán pedidos históricos"}
        </small>
      </section>

      <details className="whatsapp-technical-card">
        <summary>Detalles técnicos y diagnóstico</summary>
        <p>Identificadores no secretos. App ID y tokens no se muestran ni se guardan aquí.</p>
        <div className="whatsapp-settings-fields">
          <label>
            Business ID
            <input inputMode="numeric" value={form.businessId} onChange={(event) => update("businessId", event.target.value)} />
          </label>
          <label>
            WABA ID
            <input inputMode="numeric" value={form.wabaId} onChange={(event) => update("wabaId", event.target.value)} />
          </label>
          <label>
            Phone Number ID
            <input inputMode="numeric" value={form.phoneNumberId} onChange={(event) => update("phoneNumberId", event.target.value)} />
          </label>
        </div>
      </details>

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
