import { useEffect, useMemo, useState } from "react";
import { catalogApi } from "../api";
import StatusBadge from "./StatusBadge";
import "../styles/phase6.css";
import "../styles/phase6-commercial-costs.css";

const CATALOG_RUNTIME_LABEL = import.meta.env.VITE_CATALOG_RUNTIME_LABEL || "SQLite local";
const TTL = 24 * 60 * 60 * 1000;
const money = (value) => value == null ? "—" : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value));
const split = (value) => String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
const read = (key, fallback) => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    return saved && Date.now() - saved.savedAt <= TTL ? saved.value : fallback;
  } catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));

const DEFAULT_RULE = {
  name: "Regla guiada local", active: false, priority: 500, valid_from: "", valid_until: "", responsible: "", notes: "",
  filters: { sku: "", channel: "SHOPIFY", warehouse: "", provider: "", brand: "", collection: "", category: "", product_type: "", tags: "", price_min: "", price_max: "", cost_min: "", cost_max: "", inventory_min: "", inventory_max: "" },
  pricing: { mode: "MARKUP_PERCENT", value: "30", channel_commission_percent: "0", channel_fixed_charge: "0", payment_percent: "0", payment_fixed_charge: "0", administrative_percent: "0", administrative_fixed_charge: "0", logistics_percent: "0", logistics_fixed_charge: "0", additional_costs: [], minimum_margin_percent: "25", shipping_subsidy_used: "", reserve_cap: "0", maximum_shipping_subsidy: "0", rounding_increment: 500, minimum_price: "", maximum_price: "" },
  exception: { status: "NONE", price: "", approved_local: false },
  source: {},
};

const DRIVE_SOURCE = {
  type: "GOOGLE_SHEETS_REVIEWED",
  title: "INFORME DE PRECIOS",
  spreadsheet_id: "1EM6UVt379bIq7O96QpSe4QC8avIrqfDyYdt2bzgX4d4",
  url: "https://docs.google.com/spreadsheets/d/1EM6UVt379bIq7O96QpSe4QC8avIrqfDyYdt2bzgX4d4/edit",
  source_modified_at: "2026-08-21T21:17:11.849Z",
  reviewed_at: "2026-08-26",
  status: "HYPOTHESIS_REQUIRES_OPERATOR_REVIEW",
};

const DRIVE_RULE_TEMPLATES = [
  {
    channel: "SHOPIFY", label: "Shopify", sheet: "SHOPIFY", available: true,
    summary: "Plataforma 4% · intermediación 5% · administración 23% · logística $7.200",
    pricing: {
      mode: "GROSS_MARGIN", value: "25", minimum_margin_percent: "20",
      channel_commission_percent: "4", payment_percent: "5",
      administrative_percent: "23", logistics_fixed_charge: "7200",
      additional_costs: [{ label: "Devolución histórica (5% de logística)", basis: "FIXED", value: "360" }],
    },
    note: "La hoja calcula devolución como 5% de la logística, no como 5% de la venta.",
  },
  {
    channel: "MERCADO_LIBRE", label: "Mercado Libre", sheet: "MERCADOLIBRE", available: true,
    summary: "Plataforma 14% · intermediación 5% · administración 23% · logística $7.200",
    pricing: {
      mode: "GROSS_MARGIN", value: "25", minimum_margin_percent: "20",
      channel_commission_percent: "14", payment_percent: "5",
      administrative_percent: "23", logistics_fixed_charge: "7200",
      additional_costs: [{ label: "Devolución histórica (16% de logística)", basis: "FIXED", value: "1152" }],
    },
    note: "Hipótesis de Drive. La comisión y el envío deben reemplazarse por valores actuales del canal cuando la API los confirme.",
  },
  {
    channel: "FALABELLA", label: "Falabella", sheet: "FALABELLA", available: true,
    summary: "Plataforma 34% · administración 20% · logística $7.200",
    pricing: {
      mode: "GROSS_MARGIN", value: "25", minimum_margin_percent: "20",
      channel_commission_percent: "34", payment_percent: "0",
      administrative_percent: "20", logistics_fixed_charge: "7200",
      additional_costs: [{ label: "Devolución histórica (5% de logística)", basis: "FIXED", value: "360" }],
    },
    note: "Hipótesis de Drive. La tarifa de plataforma debe contrastarse con la liquidación o API vigente.",
  },
  {
    channel: "SODIMAC", label: "Sodimac / Homecenter", sheet: "SODIMAC", available: true,
    summary: "Sin comisión · administración interna 22% · transporte $5.000",
    pricing: {
      mode: "GROSS_MARGIN", value: "25", minimum_margin_percent: "20",
      channel_commission_percent: "0", payment_percent: "0",
      administrative_percent: "22", logistics_fixed_charge: "5000",
      additional_costs: [],
    },
    note: "Se aplicó la regla comercial indicada por el operador: Sodimac compra a PAMO y no descuenta comisión. El 22% se conserva separado como gasto administrativo interno.",
  },
  { channel: "MADECENTRO", label: "Madecentro", available: false, summary: "La hoja no contiene una pestaña Madecentro." },
  { channel: "RAPPI", label: "Rappi", available: false, summary: "La hoja no contiene una pestaña Rappi." },
];

function normalizeRule(rule) {
  return {
    ...rule,
    filters: Object.fromEntries(Object.entries(rule.filters).map(([key, value]) => key.endsWith("_min") || key.endsWith("_max") ? [key, value] : [key, split(value)])),
    pricing: { ...rule.pricing },
  };
}

function Field({ label, children, hint }) {
  return <label className="p6-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function SuggestedField({ id, label, value, onChange, options = [], hint }) {
  return <Field label={label} hint={hint}>
    <input list={id} value={value} placeholder="Déjalo vacío para incluir todos" onChange={(event) => onChange(event.target.value)} />
    <datalist id={id}>{options.map((item) => {
      const option = typeof item === "string" ? { value: item, label: item } : item;
      return <option key={option.value} value={option.value}>{option.label}</option>;
    })}</datalist>
  </Field>;
}

function FormulaChoice({ code, selected, title, formula, onSelect }) {
  return <button type="button" className={`p6-formula ${selected ? "selected" : ""}`} onClick={() => onSelect(code)}><strong>{title}</strong><span>{formula}</span></button>;
}

export function Phase6Configurator({ actorScope, stale: parentStale }) {
  const draftKey = `merci-phase6-pricing-draft:${actorScope}`;
  const cacheKey = `merci-phase6-pricing-cache:${actorScope}`;
  const [rule, setRule] = useState(() => read(draftKey, DEFAULT_RULE));
  const [workspace, setWorkspace] = useState(() => read(cacheKey, null));
  const [preview, setPreview] = useState(null);
  const [batch, setBatch] = useState(null);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [stale, setStale] = useState(false);
  const [lastSuccess, setLastSuccess] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await catalogApi.phase6Workspace();
      if (!result.ok || !result.data?.pricing) throw new Error("El servicio local no devolvió el configurador.");
      setWorkspace(result.data);
      setStale(false);
      const timestamp = new Date().toISOString();
      setLastSuccess(timestamp);
      write(cacheKey, result.data);
    } catch (error) {
      const cached = read(cacheKey, null);
      if (cached) {
        setWorkspace(cached);
        setStale(true);
        setNotice("La API local no respondió. Se conserva el último configurador correcto y se bloquean cambios.");
      } else setNotice(error.message);
    } finally { setLoading(false); }
  };
  // Recupera el último resultado bueno sin mezclarlo con borradores de otros usuarios.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  useEffect(() => { write(draftKey, rule); }, [draftKey, rule]);

  const blocked = stale || parentStale;
  const loadDriveTemplate = (template) => {
    if (!template.available) return;
    setRule({
      ...DEFAULT_RULE,
      name: `${template.label} · base Drive revisada`,
      active: false,
      priority: 500,
      notes: template.note,
      filters: { ...DEFAULT_RULE.filters, channel: template.channel },
      pricing: {
        ...DEFAULT_RULE.pricing,
        ...template.pricing,
        additional_costs: (template.pricing.additional_costs || []).map((item) => ({ ...item })),
      },
      exception: { ...DEFAULT_RULE.exception },
      source: { ...DRIVE_SOURCE, sheet: template.sheet, channel: template.channel, note: template.note },
    });
    setPreview(null); setBatch(null);
    setNotice(`Borrador ${template.label} cargado desde la fuente revisada de Drive. Revísalo antes de guardarlo o activarlo localmente.`);
  };
  const update = (section, key, value) => setRule((current) => ({ ...current, [section]: { ...current[section], [key]: value } }));
  const updateRoot = (key, value) => setRule((current) => ({ ...current, [key]: value }));
  const updateAdditionalCost = (index, key, value) => setRule((current) => ({
    ...current,
    pricing: {
      ...current.pricing,
      additional_costs: (current.pricing.additional_costs || []).map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item),
    },
  }));
  const addAdditionalCost = () => setRule((current) => ({
    ...current,
    pricing: {
      ...current.pricing,
      additional_costs: [...(current.pricing.additional_costs || []), { label: "Nuevo gasto", basis: "PERCENT_SALE", value: "0" }],
    },
  }));
  const removeAdditionalCost = (index) => setRule((current) => ({
    ...current,
    pricing: { ...current.pricing, additional_costs: (current.pricing.additional_costs || []).filter((_, itemIndex) => itemIndex !== index) },
  }));
  const displayFormula = useMemo(() => workspace?.pricing?.formula_contract || {}, [workspace]);
  const scopeOptions = workspace?.pricing?.scope_options || {};
  const scopeLabels = {
    channel: "Canal", provider: "Proveedor", brand: "Marca", collection: "Colección",
    category: "Categoría", product_type: "Tipo", sku: "SKU", tags: "Etiqueta",
    warehouse: "Bodega", price_min: "Precio desde", price_max: "Precio hasta",
    cost_min: "Costo desde", cost_max: "Costo hasta", inventory_min: "Inventario desde",
    inventory_max: "Inventario hasta",
  };
  const activeScope = Object.entries(rule.filters)
    .filter(([, value]) => String(value || "").trim())
    .map(([key, value]) => `${scopeLabels[key] || key}: ${value}`);
  const clearScope = () => setRule((current) => ({
    ...current,
    filters: Object.fromEntries(Object.keys(current.filters).map((key) => [key, ""])),
  }));

  const runPreview = async () => {
    setLoading(true); setNotice("");
    const payloadRule = normalizeRule(rule);
    const selection = { ...payloadRule.filters, limit: 5000, shipping_subsidy_used: rule.pricing.shipping_subsidy_used };
    let result;
    try {
      result = await catalogApi.phase6Pricing({ action: "PREVIEW", rule: payloadRule, selection, include_saved_rules: true, actor_label: actorScope });
    } catch {
      setLoading(false); setStale(true);
      setNotice("La API local no respondió. Se conserva la última vista previa y se bloquean cambios.");
      return;
    }
    setLoading(false);
    if (!result.ok) { setNotice(result.data?.detail || "La vista previa quedó bloqueada."); return; }
    setPreview(result.data.preview); setBatch(result.data.batch);
    setNotice(result.data.preview.status === "NO_RESULTS"
      ? "La API local respondió correctamente, pero los filtros no encontraron SKU. No es una caída del servicio."
      : `Vista previa local: ${result.data.preview.summary.ready} listos y ${result.data.preview.summary.blocked} bloqueados. Nada fue enviado.`);
    await load();
  };
  const saveRule = async () => {
    let result;
    try { result = await catalogApi.phase6Pricing({ action: "SAVE_RULE_LOCAL", rule: normalizeRule(rule), actor_label: actorScope }); }
    catch { setStale(true); setNotice("Servicio local no disponible; el borrador sigue guardado en este navegador."); return; }
    if (!result.ok) { setNotice(result.data?.detail || "No se pudo guardar la regla local."); return; }
    setNotice(`Regla guardada en ${CATALOG_RUNTIME_LABEL} como hipótesis; no publica ni sincroniza precios.`);
    await load();
  };
  const batchAction = async (action) => {
    if (!batch?.id || blocked) return;
    let result;
    try { result = await catalogApi.phase6Pricing({ action, batch_id: batch.id, actor_label: actorScope }); }
    catch { setStale(true); setNotice("Servicio local no disponible; no se aplicó ni revirtió ningún lote."); return; }
    if (!result.ok) { setNotice(result.data?.detail || "El lote se detuvo de forma segura."); return; }
    setBatch(result.data.batch);
    setNotice(action === "APPLY_LOCAL" ? `Lote aplicado solo a precios de ${CATALOG_RUNTIME_LABEL}. externalWrites=0.` : `Lote revertido en ${CATALOG_RUNTIME_LABEL}. externalWrites=0.`);
    await load();
  };

  return <section className="p6-shell">
    <div className="p6-hero"><div><span className="eyebrow">Fase 6 · primero precios</span><h2>Configurador guiado de rentabilidad</h2><p>Markup, incremento fijo y margen bruto son fórmulas distintas. El sistema siempre compara el candidato con el piso protegido.</p></div><div className="p6-safety"><strong>PROTOTIPO</strong><span>{CATALOG_RUNTIME_LABEL} · externalWrites=0</span><small>Barú: IVA incluido 19%, sin duplicarlo</small></div></div>
    {notice && <div className={`p6-notice ${stale ? "stale" : ""}`}><div><strong>{stale ? "Datos desactualizados" : "Estado local"}</strong><span>{notice}</span>{lastSuccess && <small>Última actualización correcta: {new Date(lastSuccess).toLocaleString("es-CO")}</small>}</div><button type="button" onClick={load}>Reintentar</button></div>}
    <section className="p6-drive-source">
      <header><div><span className="eyebrow">Fuente comercial revisada</span><h3>Plantillas de gastos desde “INFORME DE PRECIOS”</h3><p>Cada plantilla es un borrador auditable. No activa reglas, no cambia precios y no escribe en canales.</p></div><a href={DRIVE_SOURCE.url} target="_blank" rel="noreferrer">Abrir fuente</a></header>
      <div className="p6-drive-template-grid">{DRIVE_RULE_TEMPLATES.map((template) => <article key={template.channel} className={!template.available ? "is-unavailable" : ""}><div><strong>{template.label}</strong><span>{template.available ? "Disponible como hipótesis" : "Sin datos en la fuente"}</span></div><p>{template.summary}</p><button type="button" disabled={!template.available} onClick={() => loadDriveTemplate(template)}>{template.available ? "Cargar borrador" : "Pendiente"}</button></article>)}</div>
      {rule.source?.spreadsheet_id && <div className="p6-source-trace"><strong>Fuente aplicada al borrador</strong><span>{rule.source.title} · pestaña {rule.source.sheet} · revisada {rule.source.reviewed_at}</span><small>{rule.source.note}</small></div>}
    </section>
    <div className="p6-step"><b>1</b><div><h3>Elige cómo formar el precio candidato</h3><p>Después se calcula el piso protegido con comisión, pago, cargos, subsidio usado y margen mínimo.</p></div></div>
    <div className="p6-formulas">
      <FormulaChoice code="MARKUP_PERCENT" selected={rule.pricing.mode === "MARKUP_PERCENT"} title="Markup sobre costo" formula={displayFormula.MARKUP_PERCENT || "costo × (1 + markup %)"} onSelect={(value) => update("pricing", "mode", value)} />
      <FormulaChoice code="FIXED_INCREMENT" selected={rule.pricing.mode === "FIXED_INCREMENT"} title="Incremento fijo COP" formula={displayFormula.FIXED_INCREMENT || "costo + incremento COP"} onSelect={(value) => update("pricing", "mode", value)} />
      <FormulaChoice code="GROSS_MARGIN" selected={rule.pricing.mode === "GROSS_MARGIN"} title="Margen bruto sobre venta" formula={displayFormula.GROSS_MARGIN || "costo ÷ (1 - margen %)"} onSelect={(value) => update("pricing", "mode", value)} />
    </div>
    <div className="p6-grid p6-grid-4">
      <Field label={rule.pricing.mode === "FIXED_INCREMENT" ? "Incremento COP" : "Valor %"}><input type="number" value={rule.pricing.value} onChange={(event) => update("pricing", "value", event.target.value)} /></Field>
      <Field label="Margen mínimo sobre venta"><input type="number" value={rule.pricing.minimum_margin_percent} onChange={(event) => update("pricing", "minimum_margin_percent", event.target.value)} /></Field>
      <Field label="Comisión del canal %"><input type="number" value={rule.pricing.channel_commission_percent} onChange={(event) => update("pricing", "channel_commission_percent", event.target.value)} /></Field>
      <Field label="Tarifa de pago %"><input type="number" value={rule.pricing.payment_percent} onChange={(event) => update("pricing", "payment_percent", event.target.value)} /></Field>
      <Field label="Cargo fijo del canal"><input type="number" value={rule.pricing.channel_fixed_charge} onChange={(event) => update("pricing", "channel_fixed_charge", event.target.value)} /></Field>
      <Field label="Cargo fijo de pago"><input type="number" value={rule.pricing.payment_fixed_charge} onChange={(event) => update("pricing", "payment_fixed_charge", event.target.value)} /></Field>
      <Field label="Gasto administrativo %"><input type="number" value={rule.pricing.administrative_percent || "0"} onChange={(event) => update("pricing", "administrative_percent", event.target.value)} /></Field>
      <Field label="Gasto administrativo fijo"><input type="number" value={rule.pricing.administrative_fixed_charge || "0"} onChange={(event) => update("pricing", "administrative_fixed_charge", event.target.value)} /></Field>
      <Field label="Gasto logístico %"><input type="number" value={rule.pricing.logistics_percent || "0"} onChange={(event) => update("pricing", "logistics_percent", event.target.value)} /></Field>
      <Field label="Gasto logístico fijo"><input type="number" value={rule.pricing.logistics_fixed_charge || "0"} onChange={(event) => update("pricing", "logistics_fixed_charge", event.target.value)} /></Field>
      <Field label="Subsidio usado" hint="Déjalo vacío si todavía es UNKNOWN; escribe 0 solo si no habrá subsidio."><input type="number" value={rule.pricing.shipping_subsidy_used} onChange={(event) => update("pricing", "shipping_subsidy_used", event.target.value)} /></Field>
      <Field label="Reserva máxima" hint="Es tope, no recargo."><input type="number" value={rule.pricing.reserve_cap} onChange={(event) => update("pricing", "reserve_cap", event.target.value)} /></Field>
      <Field label="Redondeo"><select value={rule.pricing.rounding_increment} onChange={(event) => update("pricing", "rounding_increment", Number(event.target.value))}><option value={100}>100 COP</option><option value={500}>500 COP</option><option value={1000}>1.000 COP</option></select></Field>
      <Field label="Precio mínimo"><input type="number" value={rule.pricing.minimum_price} onChange={(event) => update("pricing", "minimum_price", event.target.value)} /></Field>
      <Field label="Precio máximo"><input type="number" value={rule.pricing.maximum_price} onChange={(event) => update("pricing", "maximum_price", event.target.value)} /></Field>
    </div>
    <div className="p6-custom-costs">
      <div><strong>Otros gastos configurables del canal</strong><small>Separa cada concepto; no los mezcles en una bolsa genérica.</small></div>
      {(rule.pricing.additional_costs || []).map((item, index) => <div className="p6-custom-cost-row" key={`${item.label}-${index}`}>
        <input aria-label={`Nombre del gasto ${index + 1}`} value={item.label} onChange={(event) => updateAdditionalCost(index, "label", event.target.value)} />
        <select aria-label={`Base del gasto ${index + 1}`} value={item.basis} onChange={(event) => updateAdditionalCost(index, "basis", event.target.value)}><option value="PERCENT_SALE">% sobre venta</option><option value="PERCENT_COST">% sobre costo</option><option value="FIXED">Fijo COP por unidad</option></select>
        <input aria-label={`Valor del gasto ${index + 1}`} type="number" value={item.value} onChange={(event) => updateAdditionalCost(index, "value", event.target.value)} />
        <button type="button" className="ghost" onClick={() => removeAdditionalCost(index)}>Quitar</button>
      </div>)}
      <button type="button" className="secondary" onClick={addAdditionalCost}>Agregar concepto</button>
    </div>

    <div className="p6-step"><b>2</b><div><h3>¿A qué productos se aplica?</h3><p>Déjalo vacío para incluir todos. Si completas varios campos, el producto debe cumplirlos todos. Puedes escribir varias opciones separadas por coma.</p></div></div>
    <div className="p6-scope-summary"><div><strong>{activeScope.length ? "Aplicará solamente a:" : "Aplicará a todo el catálogo"}</strong><span>{activeScope.length ? activeScope.join(" · ") : "Sin filtros: alcance masivo"}</span></div>{activeScope.length > 0 && <button type="button" onClick={clearScope}>Quitar filtros</button>}</div>
    <div className="p6-grid p6-grid-3 p6-scope-grid">
      <SuggestedField id="scope-channel" label="Canal de venta" value={rule.filters.channel} options={scopeOptions.channels} hint="Ejemplo: Shopify o Mercado Libre." onChange={(value) => update("filters", "channel", value)} />
      <SuggestedField id="scope-brand" label="Marca" value={rule.filters.brand} options={scopeOptions.brands} onChange={(value) => update("filters", "brand", value)} />
      <SuggestedField id="scope-collection" label="Colección" value={rule.filters.collection} options={scopeOptions.collections} onChange={(value) => update("filters", "collection", value)} />
      <SuggestedField id="scope-category" label="Categoría" value={rule.filters.category} options={scopeOptions.categories} onChange={(value) => update("filters", "category", value)} />
      <SuggestedField id="scope-type" label="Tipo de producto" value={rule.filters.product_type} options={scopeOptions.product_types} onChange={(value) => update("filters", "product_type", value)} />
      <SuggestedField id="scope-provider" label="Proveedor" value={rule.filters.provider} options={scopeOptions.providers} onChange={(value) => update("filters", "provider", value)} />
    </div>
    <details className="p6-advanced-filters"><summary>Más filtros: SKU, etiquetas, bodega, precio, costo o inventario</summary><div className="p6-grid p6-grid-3">
      {[ ["sku", "Solo estos SKU"], ["tags", "Etiquetas"], ["warehouse", "Bodega"] ].map(([key, label]) => <Field key={key} label={label} hint="Puedes escribir varios separados por coma."><input value={rule.filters[key]} placeholder="Déjalo vacío para incluir todos" onChange={(event) => update("filters", key, event.target.value)} /></Field>)}
      {[ ["price_min", "Precio actual desde"], ["price_max", "Precio actual hasta"], ["cost_min", "Costo desde"], ["cost_max", "Costo hasta"], ["inventory_min", "Inventario desde"], ["inventory_max", "Inventario hasta"] ].map(([key, label]) => <Field key={key} label={label}><input type="number" value={rule.filters[key]} onChange={(event) => update("filters", key, event.target.value)} /></Field>)}
    </div></details>

    <div className="p6-step"><b>3</b><div><h3>Vigencia, excepción y responsable</h3><p>Un empate con distinto cálculo se bloquea; nunca se decide por orden accidental.</p></div></div>
    <div className="p6-grid p6-grid-4">
      <Field label="Nombre"><input value={rule.name} onChange={(event) => updateRoot("name", event.target.value)} /></Field>
      <Field label="Prioridad"><input type="number" value={rule.priority} onChange={(event) => updateRoot("priority", event.target.value)} /></Field>
      <Field label="Vigente desde Colombia"><input type="date" value={rule.valid_from} onChange={(event) => updateRoot("valid_from", event.target.value)} /></Field>
      <Field label="Vigente hasta Colombia"><input type="date" value={rule.valid_until} onChange={(event) => updateRoot("valid_until", event.target.value)} /></Field>
      <Field label="Excepción"><select value={rule.exception.status} onChange={(event) => update("exception", "status", event.target.value)}><option value="NONE">Sin excepción</option><option value="PENDING">Pendiente</option><option value="BLOCKED">Bloqueada</option><option value="OVERRIDE">Precio explícito local</option></select></Field>
      <Field label="Precio de excepción"><input type="number" value={rule.exception.price} onChange={(event) => update("exception", "price", event.target.value)} /></Field>
      <Field label="Aprobación de excepción"><select value={rule.exception.approved_local ? "approved" : "pending"} onChange={(event) => update("exception", "approved_local", event.target.value === "approved")}><option value="pending">Pendiente / bloqueada</option><option value="approved">Aprobada solo local</option></select></Field>
      <Field label="Responsable"><input value={rule.responsible} onChange={(event) => updateRoot("responsible", event.target.value)} /></Field>
      <Field label="Estado"><select value={rule.active ? "active" : "inactive"} onChange={(event) => updateRoot("active", event.target.value === "active")}><option value="inactive">Inactiva / borrador</option><option value="active">Activa solo local</option></select></Field>
      <Field label="Notas"><input value={rule.notes} onChange={(event) => updateRoot("notes", event.target.value)} /></Field>
    </div>
    <div className="p6-actions"><button type="button" onClick={runPreview} disabled={blocked || loading}>Revisar productos afectados</button><button type="button" className="secondary" onClick={saveRule} disabled={blocked || loading}>Guardar regla local</button><button type="button" className="ghost" onClick={() => { setRule(DEFAULT_RULE); setPreview(null); setBatch(null); setNotice("Borrador descartado en este navegador."); }}>Descartar borrador</button></div>

    {preview && <div className="p6-preview"><header><div><span className="eyebrow">Vista previa masiva</span><h3>{preview.summary.total} productos · {preview.summary.ready} listos · {preview.summary.blocked} por revisar</h3><p>La regla incluye todo el conjunto. Para mantener la pantalla rápida, abajo se muestran máximo 50 ejemplos.</p></div><StatusBadge value={preview.status} tone={preview.status === "READY_LOCAL" ? "success" : "warning"} /></header><div className="p6-table"><table><thead><tr><th>SKU</th><th>Antes</th><th>Candidato</th><th>Piso</th><th>Después</th><th>Costo fuente</th><th>Regla</th><th>Margen</th><th>Advertencias / bloqueos</th></tr></thead><tbody>{preview.rows.slice(0, 50).map((row, index) => <tr key={`${row.sku}-${index}`}><td><strong>{row.sku}</strong></td><td>{money(row.before_price)}</td><td>{money(row.candidate_price)}</td><td>{money(row.protected_floor)}</td><td>{money(row.final_price || row.display_final_price)}</td><td>{row.cost_source}</td><td>{row.rule_resolution?.winner?.name || "Sin regla"}<small>{row.rule_resolution?.discarded?.length || 0} descartadas</small></td><td>{row.achieved_margin_percent == null ? "—" : `${Number(row.achieved_margin_percent).toFixed(1)}%`}</td><td>{[...(row.warnings || []), ...(row.blockers || [])].join(" · ") || "Sin alertas"}</td></tr>)}</tbody></table></div><div className="p6-breakdown"><strong>Orden explícito</strong><span>Costo canónico → candidato → piso protegido → mayor valor → redondeo.</span><small>Reserva añadida automáticamente: COP 0.</small></div><div className="p6-actions"><button type="button" disabled={blocked || preview.status !== "READY_LOCAL" || batch?.status !== "PREVIEW"} onClick={() => batchAction("APPLY_LOCAL")}>Aplicar a {preview.summary.total} productos solo local</button><button type="button" className="secondary" disabled={blocked || batch?.status !== "APPLIED_LOCAL"} onClick={() => batchAction("REVERSE_LOCAL")}>Revertir lote local</button><span>Lote {batch?.id || "—"} · {batch?.status || "—"}</span></div></div>}
    <div className="p6-history"><h3>Historial local reciente</h3>{(workspace?.pricing?.batches || []).slice(0, 8).map((item) => <div key={item.id}><strong>{item.status}</strong><span>{item.summary?.total || 0} SKU · {new Date(item.created_at).toLocaleString("es-CO")}</span><small>{item.reversible ? "Reversión disponible" : "Sin reversión pendiente"}</small></div>)}</div>
  </section>;
}

const DEMO_LABELS = { ONE_ORIGIN: "Un origen", MULTIPLE_ORIGINS: "Varios orígenes", INSUFFICIENT_STOCK: "Stock insuficiente", UNKNOWN_WAREHOUSE: "Bodega desconocida", NOT_QUOTABLE: "No cotizable", SHIPPING_BREAKS_MARGIN: "Envío rompe margen", TIE: "Empate" };

export function MultwarehouseSimulator({ actorScope, stale }) {
  const draftKey = `merci-phase6-cart-draft:${actorScope}`;
  const cacheKey = `merci-phase6-cart-result:${actorScope}`;
  const [cartText, setCartText] = useState(() => read(draftKey, "FT8026,1"));
  const [charge, setCharge] = useState("3000");
  const [margin, setMargin] = useState("25");
  const [result, setResult] = useState(() => read(cacheKey, null));
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [resultStale, setResultStale] = useState(false);
  const [lastSuccess, setLastSuccess] = useState(null);
  useEffect(() => { write(draftKey, cartText); }, [draftKey, cartText]);
  const run = async (demoCase = null) => {
    const cart = cartText.split("\n").map((line) => line.split(",")).filter(([sku]) => sku?.trim()).map(([sku, quantity]) => ({ sku: sku.trim(), quantity: Number(quantity || 1) }));
    setLoading(true);
    let response;
    try {
      response = await catalogApi.phase6Multwarehouse({ demo_case: demoCase, cart, customer_shipping_charge: charge, minimum_margin_percent: margin, actor_label: actorScope });
    } catch {
      setLoading(false);
      if (result) {
        setResultStale(true);
        setNotice("El servicio local no respondió. Se conserva el último resultado correcto; usa Reintentar.");
      } else setNotice("Servicio local no disponible; no se reemplazó el resultado por cero.");
      return;
    }
    setLoading(false);
    if (!response.ok) {
      if (result) {
        setResultStale(true);
        setNotice("El servicio local no respondió. Se conserva el último resultado correcto; usa Reintentar.");
      } else setNotice(response.data?.detail || "La simulación se bloqueó.");
      return;
    }
    setResult(response.data.result);
    write(cacheKey, response.data.result);
    setResultStale(false);
    setLastSuccess(new Date().toISOString());
    setNotice(demoCase ? "Escenario DEMO aislado: no es tarifa actual ni evidencia comercial." : "Simulación local terminada. No se creó guía ni se consultó Envía.");
  };
  return <section className="p6-shell">
    <div className="p6-hero"><div><span className="eyebrow">Fase 6 · después logística</span><h2>Simulador multibodega</h2><p>Cada SKU es indivisible. Una guía por origen, solo con stock verificable y margen protegido.</p></div><div className="p6-safety warning"><strong>FIXTURE</strong><span>ESTIMADO / DEMO</span><small>Nunca tarifa actual · nunca genera guía</small></div></div>
    {notice && <div className={`p6-notice ${resultStale ? "stale" : ""}`}><div><strong>{resultStale ? "Resultado desactualizado" : "Estado de la simulación"}</strong><span>{notice}</span>{lastSuccess && <small>Última actualización correcta: {new Date(lastSuccess).toLocaleString("es-CO")}</small>}</div>{resultStale && <button type="button" onClick={() => run()}>Reintentar</button>}</div>}
    <div className="p6-real-block"><strong>Estado real actual: NO COTIZABLE</strong><span>0/959 SKU tienen dimensiones PACKAGE confirmadas; inventario y bodega Barú siguen UNKNOWN.</span><small>La interfaz no convierte faltantes en cero ni inventa stock.</small></div>
    <div className="p6-cart-grid"><Field label="Carrito" hint="Una línea por SKU: SKU,cantidad"><textarea rows="7" value={cartText} onChange={(event) => setCartText(event.target.value)} /></Field><div className="p6-grid"><Field label="Cobro de envío al cliente"><input type="number" value={charge} onChange={(event) => setCharge(event.target.value)} /></Field><Field label="Margen mínimo del pedido"><input type="number" value={margin} onChange={(event) => setMargin(event.target.value)} /></Field><button type="button" onClick={() => run()} disabled={stale || resultStale || loading}>Simular con datos locales</button></div></div>
    <div className="p6-demo-cases"><strong>Casos DEMO aislados</strong><div>{Object.entries(DEMO_LABELS).map(([code, label]) => <button type="button" key={code} onClick={() => run(code)} disabled={stale || resultStale || loading}>{label}</button>)}</div></div>
    {result && <div className="p6-logistics-result"><header><div><span className="eyebrow">Resultado explicable</span><h3>{result.status}</h3><p>{result.algorithm_note || "La falta de datos verificables bloqueó la asignación."}</p></div><StatusBadge value={result.quote_basis} tone="warning" /></header>{result.blockers?.length > 0 && <div className="p6-blockers">{result.blockers.map((item) => <span key={item}>{item}</span>)}</div>}{result.strategies?.length > 0 && <div className="p6-strategies">{result.strategies.map((strategy) => <article key={strategy.code}><span>{strategy.label}</span><strong>{strategy.guide_count} guía(s) · {money(strategy.logistics_cost)}</strong><small>Margen antes {Number(strategy.margin_before_logistics).toFixed(1)}% → después {Number(strategy.margin_after_logistics).toFixed(1)}%</small><div>{strategy.guides.map((guide) => <em key={guide.origin}>{guide.origin}: {money(guide.cost)} · {guide.skus.join(", ")}</em>)}</div></article>)}</div>}{result.recommended_strategy && <div className="p6-recommendation"><strong>Recomendación de planificación: {result.recommended_strategy.code}</strong><span>{result.recommended_strategy.reason}</span><small>Commercialmente elegible: NO. Hace falta cotización actual y datos PACKAGE confirmados.</small></div>}</div>}
  </section>;
}
