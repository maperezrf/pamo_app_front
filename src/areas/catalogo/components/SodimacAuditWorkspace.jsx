import { useEffect, useMemo, useState } from "react";
import { catalogApi } from "../api";
import StatusBadge from "./StatusBadge";

const TTL = 24 * 60 * 60 * 1000;
const DEFAULT_MAPPING = {
  canonical_sku: "sku_pamo", sodimac_sku: "sku_sodimac", listing_id: "sku_sodimac",
  listing_url: "url_sodimac", title: "titulo_sodimac", brand: "marca_sodimac",
  description: "descripcion_sodimac", image_urls: "imagenes_urls", attributes: "atributos_json",
  barcode: "ean",
  publication_state: "estado_publicacion", inventory_available: "inventario",
  inventory_source: "fuente_inventario", provider: "proveedor", warehouse: "bodega",
  source_date: "fecha_archivo", last_verified_at: "ultima_verificacion",
};
const FIELD_LABELS = {
  canonical_sku: "SKU PAMO", sodimac_sku: "SKU Sodimac", listing_id: "ID publicación",
  listing_url: "URL Sodimac", title: "Título", brand: "Marca", description: "Descripción",
  barcode: "EAN",
  image_urls: "Imágenes", attributes: "Atributos", publication_state: "Estado publicación",
  inventory_available: "Inventario", inventory_source: "Fuente inventario", provider: "Proveedor",
  warehouse: "Bodega", source_date: "Fecha archivo", last_verified_at: "Última verificación",
};

const read = (key, fallback) => {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    return saved?.savedAt && Date.now() - saved.savedAt <= TTL ? saved.value : fallback;
  } catch { return fallback; }
};
const write = (key, value) => localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), value }));
const money = (value) => value == null ? "Pendiente" : new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value));

export default function SodimacAuditWorkspace({ actorScope, parentStale, onCatalogChanged }) {
  const keys = useMemo(() => ({
    filters: `merci-sodimac-filters-v1:${actorScope}`,
    mapping: `merci-sodimac-mapping-v2:${actorScope}`,
    cache: `merci-sodimac-cache-v2:${actorScope}`,
  }), [actorScope]);
  const [data, setData] = useState(() => read(keys.cache, null)?.data || null);
  const [filters, setFilters] = useState(() => read(keys.filters, { link_status: "", quality: "", freshness: "", missing: "", inventory: "", provider: "", warehouse: "" }));
  const [mapping, setMapping] = useState(() => read(keys.mapping, DEFAULT_MAPPING));
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);
  const [lastSuccess, setLastSuccess] = useState(() => read(keys.cache, null)?.lastSuccess || null);
  const [loading, setLoading] = useState(false);
  const [kitQuery, setKitQuery] = useState("");
  const [kitStatus, setKitStatus] = useState("");
  const [kitReadiness, setKitReadiness] = useState("");
  const [kitLimit, setKitLimit] = useState(25);

  const load = async (requestedFilters = filters) => {
    setLoading(true);
    try {
      const result = await catalogApi.sodimacWorkspace(requestedFilters);
      if (!result.ok || !result.data?.summary || !Array.isArray(result.data?.links)) throw new Error("La API local de Sodimac no devolvió un resultado válido.");
      const timestamp = new Date().toISOString();
      setData(result.data); setLastSuccess(timestamp); setStale(false); setNotice("");
      write(keys.cache, { data: result.data, lastSuccess: timestamp });
    } catch (error) {
      const cached = read(keys.cache, null);
      if (cached?.data) {
        setData(cached.data); setLastSuccess(cached.lastSuccess); setStale(true);
        setNotice("Servicio no disponible. Se conserva el último resultado correcto y se bloquean cambios locales.");
      } else setNotice(error.message);
    } finally { setLoading(false); }
  };

  // Carga una vez; el operador controla filtros y reintentos explícitos.
  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);
  useEffect(() => { write(keys.filters, filters); }, [filters, keys]);
  useEffect(() => { write(keys.mapping, mapping); }, [mapping, keys]);

  const blocked = parentStale || stale;
  const action = async (body) => {
    if (blocked) return;
    setLoading(true);
    const payload = body instanceof FormData ? body : { ...body, actor_label: actorScope };
    if (body instanceof FormData && !body.has("actor_label")) body.append("actor_label", actorScope);
    const result = await catalogApi.sodimacAction(payload);
    setLoading(false);
    if (!result.ok) { setNotice(result.data?.detail || "La acción local quedó bloqueada."); return; }
    if (result.data?.batch) setNotice(`Lote ${result.data.batch.status}: ${result.data.batch.valid_rows} válidas, ${result.data.batch.conflict_rows} conflictos, ${result.data.batch.rejected_rows} rechazadas. externalWrites=0.`);
    else if (result.data?.kit_batch) setNotice(`Kits ${result.data.kit_batch.status}: ${result.data.kit_batch.kit_count} kits y ${result.data.kit_batch.component_rows} componentes. externalWrites=0.`);
    else setNotice(`${result.data.created} tareas locales nuevas; sin red ni cron.`);
    await load(filters);
    onCatalogChanged?.();
  };

  const upload = async (file) => {
    if (!file || blocked) return;
    const form = new FormData();
    form.append("action", "PREVIEW_IMPORT");
    form.append("actor_label", actorScope);
    form.append("header_mapping", JSON.stringify(mapping));
    form.append("file", file);
    await action(form);
  };

  const summary = data?.summary || {};
  const kitSummary = data?.kit_summary || {};
  const filteredKits = useMemo(() => {
    const query = kitQuery.trim().toLocaleUpperCase("es-CO");
    return (data?.kits || []).filter((kit) => {
      const searchable = [kit.sodimac_kit_sku, kit.canonical_sku, kit.ean, ...kit.components.map((component) => component.sku)]
        .filter(Boolean).join(" ").toLocaleUpperCase("es-CO");
      if (query && !searchable.includes(query)) return false;
      if (kitStatus && kit.status !== kitStatus) return false;
      if (kitReadiness === "COST_READY" && !kit.economics.cost_complete) return false;
      if (kitReadiness === "COST_PENDING" && kit.economics.cost_complete) return false;
      if (kitReadiness === "INVENTORY_READY" && kit.economics.possible_kit_units == null) return false;
      if (kitReadiness === "INVENTORY_PENDING" && kit.economics.possible_kit_units != null) return false;
      return true;
    });
  }, [data?.kits, kitQuery, kitReadiness, kitStatus]);
  const visibleKits = filteredKits.slice(0, kitLimit);
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  return <section className="sodimac-audit-shell">
    <header className="sodimac-hero"><div><span className="eyebrow">Sodimac / Homecenter · identidad por archivo</span><h2>Publicaciones y kits organizados por evidencia</h2><p>El SKU PAMO y el SKU Sodimac conservan identidades distintas. Los kits son recetas con componentes y cantidades; costos, precios de referencia e inventario se derivan sin convertir faltantes en cero.</p></div><div className="sodimac-safety"><strong>LOCAL ONLY</strong><span>externalWrites=0</span><small>Inventario y pedidos desconectados</small></div></header>
    {notice && <div className={`continuity-notice ${stale ? "stale" : ""}`}><div><strong>{stale ? "Vista desactualizada" : "Estado local"}</strong><span>{notice}</span>{lastSuccess && <small>Última actualización correcta: {new Date(lastSuccess).toLocaleString("es-CO")}</small>}</div><button type="button" onClick={() => load(filters)}>Reintentar</button></div>}

    <div className="sodimac-kpis">
      <article><span>Cobertura de vínculo</span><strong>{summary.coverage_percent || 0}%</strong><small>{summary.active_links || 0} de {summary.canonical_variants || 0} variantes</small></article>
      <article><span>Verificadas vigentes</span><strong>{summary.verified || 0}</strong><small>Resultado aprobable, no publicación</small></article>
      <article><span>Vencidas</span><strong>{summary.stale || 0}</strong><small>Revalidación incremental</small></article>
      <article><span>Críticas</span><strong>{summary.critical || 0}</strong><small>Bloqueos explicables</small></article>
      <article><span>Calidad media</span><strong>{summary.average_score || 0}</strong><small>Seis dimensiones</small></article>
      <article><span>Inventario observable</span><strong>{summary.inventory_observable || 0}</strong><small>Solo cuando existe fuente</small></article>
    </div>

    <div className="sodimac-grid-two">
      <article className="sodimac-card"><header><div><span className="eyebrow">1 · Archivo de publicaciones</span><h3>SKU PAMO ↔ SKU Sodimac</h3></div><StatusBadge value={data?.imports?.some((batch) => !batch.is_fixture && ["APPLIED_LOCAL", "APPLIED_PARTIAL"].includes(batch.status)) ? "CARGADO" : "PENDIENTE"} tone={data?.imports?.some((batch) => !batch.is_fixture && ["APPLIED_LOCAL", "APPLIED_PARTIAL"].includes(batch.status)) ? "success" : "warning"} /></header><p>La relación exacta se conserva por ambos SKU. Las filas sin producto PAMO o con duplicidad quedan en revisión y no bloquean los vínculos verificables.</p><div className="sodimac-actions"><label className="file-action">Revisar publicaciones<input type="file" accept=".csv,.xlsx" disabled={blocked || loading} onChange={(event) => upload(event.target.files?.[0])} /></label><button type="button" disabled={blocked || loading} onClick={() => action({ action: "LOAD_DEMO_FIXTURE" })}>Cargar fixture DEMO</button></div><details className="mapping-panel"><summary>Mapeo de encabezados</summary><div>{Object.entries(mapping).map(([key, value]) => <label key={key}><span>{FIELD_LABELS[key] || key}{["canonical_sku", "sodimac_sku"].includes(key) ? " *" : ""}</span><input value={value} onChange={(event) => setMapping((current) => ({ ...current, [key]: event.target.value }))} /></label>)}</div></details></article>
      <article className="sodimac-card"><header><div><span className="eyebrow">2 · Contrato diario futuro</span><h3>Incremental por riesgo</h3></div><StatusBadge value="CRON NO CONFIGURADO" tone="neutral" /></header><ul><li>Solo vencidos, cambiados, críticos o prioritarios.</li><li>Cache por fingerprint, máximo 3 intentos y backoff.</li><li>Sin CAPTCHA, login, bypass ni rastreo masivo.</li><li>Fallback manual/archivo si la página no es estable o permitida.</li></ul><button type="button" disabled={blocked || loading} onClick={() => action({ action: "ENQUEUE_INCREMENTAL_LOCAL" })}>Preparar cola local</button><small>El adaptador público requiere aprobación jurídica/técnica y contrato de tasa antes de conectarse.</small></article>
    </div>

    <section className="sodimac-filterbar">
      <label><span>Vínculo</span><select value={filters.link_status} onChange={(event) => updateFilter("link_status", event.target.value)}><option value="">Todos</option>{["UNLINKED","LINKED_EXACT","AMBIGUOUS","STALE","NOT_FOUND","NEEDS_REVIEW"].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Calidad</span><select value={filters.quality} onChange={(event) => updateFilter("quality", event.target.value)}><option value="">Todas</option><option value="APPROVED">Aprobable</option><option value="WARNING">Advertencia</option><option value="BLOCKER">Bloqueo</option></select></label>
      <label><span>Última verificación</span><select value={filters.freshness} onChange={(event) => updateFilter("freshness", event.target.value)}><option value="">Todas</option><option value="current">Vigente</option><option value="stale">Vencida</option><option value="never">Sin verificar</option></select></label>
      <label><span>Faltantes</span><select value={filters.missing} onChange={(event) => updateFilter("missing", event.target.value)}><option value="">Todos</option><option value="yes">Con faltantes</option><option value="no">Sin faltantes críticos</option></select></label>
      <label><span>Inventario</span><select value={filters.inventory} onChange={(event) => updateFilter("inventory", event.target.value)}><option value="">Todos</option><option value="known">Con fuente</option><option value="unknown">Desconocido</option></select></label>
      <label><span>Proveedor</span><input value={filters.provider} onChange={(event) => updateFilter("provider", event.target.value)} /></label>
      <label><span>Bodega</span><input value={filters.warehouse} onChange={(event) => updateFilter("warehouse", event.target.value)} /></label>
      <button type="button" onClick={() => load(filters)} disabled={loading}>Aplicar</button>
    </section>

    <div className="catalog-table-card density-compact"><div className="catalog-table-scroll"><table className="sodimac-table"><thead><tr><th>SKU PAMO</th><th>SKU / publicación Sodimac</th><th>Vínculo</th><th>Publicación</th><th>Inventario</th><th>Calidad</th><th>Última evidencia</th><th>Alerta</th></tr></thead><tbody>{(data?.links || []).map((link) => { const observation = link.latest_observation; return <tr key={link.id}><td><strong>{link.canonical_sku}</strong><small>{link.source_kind}</small></td><td><strong>{link.sodimac_sku}</strong><small>{link.listing_id || "ID pendiente"}</small>{link.listing_url && <a href={link.listing_url} target="_blank" rel="noreferrer">Abrir evidencia</a>}</td><td><StatusBadge value={link.status} tone={link.status === "LINKED_EXACT" ? "success" : "warning"} /></td><td>{observation?.publication_state || "UNKNOWN"}<small>{observation?.evidence_class || "UNKNOWN"}</small></td><td>{observation?.inventory_available ?? "UNKNOWN"}<small>{observation?.inventory_source || "UNKNOWN"}</small></td><td><strong>{observation?.overall_score ?? "—"}/100</strong><small>{observation ? Object.entries(observation.dimension_scores || {}).map(([key, value]) => `${key} ${value}`).join(" · ") : "Sin observación"}</small></td><td>{observation?.observed_at ? new Date(observation.observed_at).toLocaleString("es-CO") : "Pendiente"}<small>{observation?.expires_at ? `Vence ${new Date(observation.expires_at).toLocaleDateString("es-CO")}` : "Sin vigencia"}</small></td><td><StatusBadge value={observation?.severity || "NEEDS_REVIEW"} tone={observation?.severity === "APPROVED" ? "success" : "warning"} /></td></tr>; })}{!data?.links?.length && <tr><td colSpan="8" className="empty-state">Sin resultados para estos filtros. No equivale a servicio caído ni a datos borrados.</td></tr>}</tbody></table></div></div>

    <section className="sodimac-kit-section">
      <header><div><span className="eyebrow">Kits y combos Sodimac</span><h3>Recetas calculadas desde sus componentes PAMO</h3><p>La cantidad multiplica costo, precio de referencia y consumo de inventario. El precio final permanece pendiente hasta aplicar una política comercial Sodimac aprobada.</p></div><StatusBadge value={`${kitSummary.kits || 0} KITS`} tone="success" /></header>
      <div className="sodimac-kit-kpis"><article><span>Kits</span><strong>{kitSummary.kits || 0}</strong></article><article><span>Resueltos</span><strong>{kitSummary.resolved || 0}</strong></article><article><span>Por revisar</span><strong>{kitSummary.review || 0}</strong></article><article><span>Componentes</span><strong>{kitSummary.component_rows || 0}</strong></article><article><span>Costo completo</span><strong>{kitSummary.cost_complete || 0}</strong></article><article><span>Inventario calculable</span><strong>{kitSummary.inventory_complete || 0}</strong></article></div>
      <div className="sodimac-kit-tools">
        <label><span>Buscar kit o componente</span><input value={kitQuery} placeholder="SKU Sodimac, SKU PAMO o EAN" onChange={(event) => { setKitQuery(event.target.value); setKitLimit(25); }} /></label>
        <label><span>Estado de receta</span><select value={kitStatus} onChange={(event) => { setKitStatus(event.target.value); setKitLimit(25); }}><option value="">Todos</option><option value="RESOLVED">Componentes resueltos</option><option value="PARTIAL">Por revisar</option></select></label>
        <label><span>Disponibilidad de cálculo</span><select value={kitReadiness} onChange={(event) => { setKitReadiness(event.target.value); setKitLimit(25); }}><option value="">Todos</option><option value="COST_READY">Costo completo</option><option value="COST_PENDING">Costo pendiente</option><option value="INVENTORY_READY">Inventario calculable</option><option value="INVENTORY_PENDING">Inventario pendiente</option></select></label>
        <strong>{visibleKits.length} visibles de {filteredKits.length}</strong>
      </div>
      <div className="catalog-table-card density-compact"><div className="catalog-table-scroll"><table className="sodimac-kit-table"><thead><tr><th>Kit Sodimac</th><th>SKU PAMO relacionado</th><th>Composición</th><th>Costo componentes</th><th>Precio referencia</th><th>Unidades posibles</th><th>Estado</th></tr></thead><tbody>{visibleKits.map((kit) => <tr key={kit.id}><td><strong>{kit.sodimac_kit_sku}</strong><small>{kit.ean || "EAN pendiente"}</small></td><td>{kit.canonical_sku || "Kit propio de Sodimac"}<small>{kit.canonical_match}</small></td><td><details><summary>{kit.component_count} componentes</summary>{kit.components.map((component) => <small key={`${kit.id}-${component.sku}`}>{component.quantity} × {component.sku} · {component.match_status}</small>)}</details></td><td><strong>{money(kit.economics.component_cost_total)}</strong><small>{kit.economics.cost_complete ? "Costo canónico sumado" : "Faltan costos o componentes"}</small></td><td><strong>{money(kit.economics.component_reference_price_total)}</strong><small>{kit.economics.pricing_status}</small></td><td><strong>{kit.economics.possible_kit_units ?? "Pendiente"}</strong><small>{kit.economics.inventory_status}</small></td><td><StatusBadge value={kit.status} tone={kit.status === "RESOLVED" ? "success" : "warning"} /></td></tr>)}{!filteredKits.length && <tr><td colSpan="7" className="empty-state">No hay kits que coincidan con estos filtros.</td></tr>}</tbody></table></div></div>
      {visibleKits.length < filteredKits.length && <button className="sodimac-kit-more" type="button" onClick={() => setKitLimit((current) => current + 25)}>Mostrar 25 recetas más</button>}
    </section>

    <div className="sodimac-grid-two">
      <article className="sodimac-card"><h3>Importaciones de publicaciones</h3>{(data?.imports || []).map((batch) => <div className="sodimac-batch" key={batch.id}><div><strong>{batch.filename}</strong><StatusBadge value={batch.is_fixture ? `${batch.status} · DEMO` : batch.status} tone={["APPLIED_LOCAL", "APPLIED_PARTIAL"].includes(batch.status) ? "success" : batch.conflict_rows || batch.rejected_rows ? "warning" : "neutral"} /><small>{batch.valid_rows} válidas · {batch.duplicate_rows} duplicadas · {batch.conflict_rows} conflictos · {batch.rejected_rows} rechazadas</small></div><div><button type="button" disabled={blocked || !["PREVIEW", "PREVIEW_PARTIAL"].includes(batch.status) || ((batch.conflict_rows > 0 || batch.rejected_rows > 0) && !batch.allow_partial)} onClick={() => action({ action: "APPLY_IMPORT_LOCAL", batch_id: batch.id })}>Aplicar local</button><button type="button" disabled={blocked || !["APPLIED_LOCAL", "APPLIED_PARTIAL"].includes(batch.status)} onClick={() => action({ action: "REVERSE_IMPORT_LOCAL", batch_id: batch.id })}>Revertir</button></div>{batch.rows?.some((row) => row.errors.length || row.conflicts.length) && <details><summary>Conflictos por fila</summary>{batch.rows.filter((row) => row.errors.length || row.conflicts.length).map((row) => <small key={row.id}>Fila {row.row_number} · {row.canonical_sku || "sin SKU"}: {[...row.errors, ...row.conflicts].join(" · ")}</small>)}</details>}</div>)}{!data?.imports?.length && <p>No hay archivos revisados todavía.</p>}</article>
      <article className="sodimac-card"><h3>Importaciones de kits</h3>{(data?.kit_imports || []).map((batch) => <div className="sodimac-batch" key={batch.id}><div><strong>{batch.filename}</strong><StatusBadge value={batch.status} tone={batch.status === "APPLIED_LOCAL" ? "success" : "neutral"} /><small>{batch.kit_count} kits · {batch.component_rows} componentes · {batch.resolved_kits} resueltos · {batch.review_kits} por revisar</small><small>{batch.exact_components} exactos · {batch.missing_components} ausentes · {batch.ambiguous_components} ambiguos</small></div><div><button type="button" disabled={blocked || batch.status !== "APPLIED_LOCAL"} onClick={() => action({ action: "REVERSE_KIT_IMPORT_LOCAL", batch_id: batch.id })}>Revertir</button></div></div>)}{!data?.kit_imports?.length && <p>No hay kits importados todavía.</p>}</article>
      <article className="sodimac-card"><h3>Cola incremental</h3>{(data?.tasks || []).slice(0, 12).map((task) => <div className="sodimac-task" key={task.id}><b>{task.priority}</b><span><strong>{task.canonical_sku} ↔ {task.sodimac_sku}</strong><small>{task.reason}</small></span><StatusBadge value={task.status} tone={task.status === "COMPLETED" ? "success" : "warning"} /></div>)}{!data?.tasks?.length && <p>Sin tareas: configure vínculos o cargue el fixture DEMO.</p>}</article>
    </div>

    <article className="sodimac-card adapter-boundary"><h3>Separación de adaptadores</h3><div><span><b>Archivo catálogo</b> Implementado local</span><span><b>Página pública</b> Contrato, no conectado</span><span><b>API inventario</b> Desconectada; solo inventario</span><span><b>API pedidos</b> Desconectada; una venta no prueba calidad</span></div></article>
  </section>;
}
