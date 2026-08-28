import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api";
import "../styles/shipping-delivery.css";


const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const EMPTY_FORM = {
  department: "",
  city: "",
  fulfillment_origin: "ENVIA",
  order_subtotal: "",
  product_cost_total: "",
  wholesale_discount_percent: "0",
  standard_shipping_estimate: "",
  customer_shipping_charge: "",
};

function readDraft(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (!saved?.savedAt || Date.now() - saved.savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(key);
      return EMPTY_FORM;
    }
    return { ...EMPTY_FORM, ...saved.form };
  } catch {
    return EMPTY_FORM;
  }
}

function cop(value) {
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(number);
}

function localDate(value) {
  if (!value) return "Todavía no se ha calculado";
  return new Intl.DateTimeFormat("es-CO", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function ShippingDeliveryWorkspace({ user }) {
  const identity = user?.email || user?.username || "local";
  const draftKey = useMemo(() => `pamo-shipping-phase1:${identity}`, [identity]);
  const [form, setForm] = useState(() => readDraft(draftKey));
  const [workspace, setWorkspace] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState(null);

  useEffect(() => {
    localStorage.setItem(draftKey, JSON.stringify({ form, savedAt: Date.now() }));
  }, [draftKey, form]);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await api.shippingDeliveryWorkspace();
    if (response.ok) {
      setWorkspace(response.data);
      setStale(false);
      setLastSuccessfulAt(new Date().toISOString());
    } else {
      setStale(Boolean(workspace));
      setError(response.data?.detail || "No fue posible actualizar las reglas de envío.");
    }
    setLoading(false);
  }, [workspace]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const response = await api.shippingDeliveryWorkspace();
      if (!active) return;
      if (response.ok) {
        setWorkspace(response.data);
        setLastSuccessfulAt(new Date().toISOString());
      } else {
        setError(response.data?.detail || "No fue posible cargar el módulo.");
      }
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, []);

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const simulate = async (event) => {
    event?.preventDefault();
    setCalculating(true);
    setError("");
    const response = await api.simulateStandardShipping(form);
    if (response.ok) {
      setResult(response.data);
      setStale(false);
      setLastSuccessfulAt(new Date().toISOString());
    } else {
      setStale(Boolean(result));
      setError(response.data?.detail || "No fue posible calcular el envío estándar.");
    }
    setCalculating(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    setForm(EMPTY_FORM);
    setResult(null);
    setError("");
    setStale(false);
  };

  if (loading && !workspace) {
    return <div className="shipping-loading">Cargando Envíos y entrega…</div>;
  }

  return (
    <section className="shipping-workspace">
      <header className="shipping-hero">
        <div>
          <p className="shipping-breadcrumb">Operación / Logística / Fase local</p>
          <span className="shipping-kicker">Envío estándar</span>
          <h1>Envíos y entrega</h1>
          <p>
            Calcula una referencia sencilla por ciudad y protege el margen del pedido antes de prometer una entrega.
          </p>
        </div>
        <div className="shipping-safety">
          <strong>FASE 1</strong>
          <span>Solo simulación</span>
          <small>Sin guías · sin Shopify · externalWrites=0</small>
        </div>
      </header>

      <div className={`shipping-continuity${stale ? " stale" : ""}`}>
        <div>
          <strong>{stale ? "Mostrando el último cálculo correcto" : "Reglas disponibles"}</strong>
          <span>Última actualización correcta: {localDate(lastSuccessfulAt)}</span>
        </div>
        <button type="button" onClick={stale ? simulate : loadWorkspace} disabled={loading || calculating}>
          Reintentar
        </button>
      </div>

      {error && <div className="shipping-error" role="alert">{error}</div>}

      <div className="shipping-summary-grid">
        <article>
          <small>Opción al cliente</small>
          <strong>Envío estándar</strong>
          <span>Única modalidad activa por ahora</span>
        </article>
        <article>
          <small>Destino inicial</small>
          <strong>Ciudad + departamento</strong>
          <span>Sin exigir código postal</span>
        </article>
        <article>
          <small>Margen mínimo</small>
          <strong>20%</strong>
          <span>Después del descuento y subsidio</span>
        </article>
        <article>
          <small>Promedio histórico</small>
          <strong>{cop(workspace?.average_shipping_reference?.amount)}</strong>
          <span>
            {workspace?.average_shipping_reference?.available
              ? `${workspace.average_shipping_reference.sample_size} guías · informativo`
              : "Aún sin base verificable"}
          </span>
        </article>
      </div>

      <div className="shipping-main-grid">
        <form className="shipping-card shipping-form" onSubmit={simulate}>
          <header>
            <div>
              <span className="shipping-kicker">Simulador del pedido</span>
              <h2>Calcular envío estándar</h2>
              <p>Los valores permanecen como borrador durante 24 horas para este usuario.</p>
            </div>
            <button type="button" className="shipping-text-button" onClick={discardDraft}>Limpiar</button>
          </header>

          <div className="shipping-fields destination-fields">
            <label>
              <span>Departamento</span>
              <input name="department" value={form.department} onChange={update} placeholder="Ej. Antioquia" required />
            </label>
            <label>
              <span>Ciudad</span>
              <input name="city" value={form.city} onChange={update} placeholder="Ej. Medellín" required />
            </label>
            <label>
              <span>¿Desde dónde sale?</span>
              <select name="fulfillment_origin" value={form.fulfillment_origin} onChange={update}>
                <option value="ENVIA">Bodega Envía</option>
                <option value="SUPPLIER">Despacho del proveedor</option>
              </select>
            </label>
          </div>

          <div className="shipping-fields money-fields">
            <label>
              <span>Valor normal del pedido</span>
              <input type="number" min="1" name="order_subtotal" value={form.order_subtotal} onChange={update} placeholder="200000" required />
            </label>
            <label>
              <span>Costo total de productos</span>
              <input type="number" min="0" name="product_cost_total" value={form.product_cost_total} onChange={update} placeholder="100000" required />
            </label>
            <label>
              <span>Descuento mayorista %</span>
              <input type="number" min="0" max="100" step="0.01" name="wholesale_discount_percent" value={form.wholesale_discount_percent} onChange={update} />
            </label>
            <label>
              <span>Envío estándar estimado</span>
              <input type="number" min="1" name="standard_shipping_estimate" value={form.standard_shipping_estimate} onChange={update} placeholder="18000" required />
              <small>Referencia manual por ciudad; todavía no es una cotización de transportadora.</small>
            </label>
            <label>
              <span>El cliente paga por envío</span>
              <input type="number" min="0" name="customer_shipping_charge" value={form.customer_shipping_charge} onChange={update} placeholder="18000" required />
            </label>
          </div>

          <button className="shipping-primary" type="submit" disabled={calculating}>
            {calculating ? "Calculando…" : "Calcular pedido"}
          </button>
        </form>

        <aside className="shipping-card shipping-rules">
          <span className="shipping-kicker">Reglas activas</span>
          <h2>Qué protege el sistema</h2>
          <ol>
            <li><b>Una sola opción:</b> por ahora el cliente ve únicamente envío estándar.</li>
            <li><b>Origen real:</b> distingue inventario en Envía y despacho del proveedor.</li>
            <li><b>Compra mayorista:</b> recalcula el margen después de aplicar el descuento.</li>
            <li><b>Margen inferior al 20%:</b> exige ajustar descuento o subsidio, o solicitar aprobación.</li>
            <li><b>Sin tarifa confirmada:</b> nunca convierte un error o un dato faltante en envío gratis.</li>
          </ol>
          <div className="shipping-provider-note">
            <strong>Si sale del proveedor</strong>
            <span>No se promete fecha hasta confirmar inventario, costo y tiempo de despacho.</span>
          </div>
        </aside>
      </div>

      {result && (
        <section className={`shipping-result ${result.commercial.margin_protected ? "protected" : "review"}`}>
          <header>
            <div>
              <span className="shipping-kicker">Resultado</span>
              <h2>{result.decision.label}</h2>
              <p>{result.decision.recommendation}</p>
            </div>
            <strong>{result.commercial.margin_percent}% margen</strong>
          </header>
          <div>
            <article><small>Venta después del descuento</small><b>{cop(result.commercial.net_product_revenue)}</b></article>
            <article><small>Descuento aplicado</small><b>{cop(result.commercial.discount_amount)}</b></article>
            <article><small>Subsidio de la empresa</small><b>{cop(result.commercial.company_shipping_subsidy)}</b></article>
            <article><small>Utilidad después del envío</small><b>{cop(result.commercial.profit_after_shipping)}</b></article>
            <article><small>Descuento máximo seguro</small><b>{result.commercial.maximum_safe_discount_percent}%</b></article>
            <article><small>Origen</small><b>{result.fulfillment.label}</b></article>
          </div>
          <p className="shipping-promise">{result.fulfillment.promise}</p>
          {result.warnings?.length > 0 && (
            <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
          )}
        </section>
      )}

      <details className="shipping-phase-two">
        <summary>Segunda fase — todavía desactivada</summary>
        <div>
          {workspace?.phase_2?.items?.map((item) => <span key={item}>{item}</span>)}
        </div>
      </details>
    </section>
  );
}
