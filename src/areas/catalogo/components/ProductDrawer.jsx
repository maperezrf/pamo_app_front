import { useState } from "react";
import StatusBadge from "./StatusBadge";

const money = (value) =>
  value == null
    ? "Pendiente"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(Number(value));
const channels = [
  ["SHOPIFY", "Shopify"],
  ["MERCADO_LIBRE", "Mercado Libre"],
  ["FALABELLA", "Falabella"],
  ["SODIMAC", "Sodimac"],
  ["MADECENTRO", "Madecentro"],
  ["RAPPI", "Rappi"],
];
const evidenceValue = (value) =>
  value == null
    ? "UNKNOWN"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

export default function ProductDrawer({ product, onClose, history = [] }) {
  const [tab, setTab] = useState("Producto");
  if (!product) return null;
  const variant = product.variants?.[0] || {};
  const image = product.images?.[0];
  const sodimacLinks = (variant.sodimac_catalog_links || []).filter(
    (link) => link.active,
  );
  const tabs = [
    "Producto",
    "Costos",
    "Inventario y envíos",
    "Canales",
    "Sodimac",
    "Calidad",
    "Historial",
  ];

  return (
    <div className="catalog-drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="catalog-drawer"
        onMouseDown={(event) => event.stopPropagation()}
        aria-label={`Ficha de ${product.title}`}
      >
        <header>
          <div>
            <span className="eyebrow">Ficha multicanal</span>
            <h2>{product.title}</h2>
            <p>
              {variant.sku || "SKU pendiente"} ·{" "}
              {product.vendor || "Proveedor pendiente"}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Cerrar ficha"
          >
            ×
          </button>
        </header>
        <nav className="drawer-tabs">
          {tabs.map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="drawer-body">
          {tab === "Producto" && (
            <>
              <div className="product-identity">
                {image ? (
                  <img
                    src={image.source_url}
                    alt={image.alt_text || "Imagen de producto"}
                  />
                ) : (
                  <div className="image-placeholder">Sin imagen</div>
                )}
                <dl>
                  <div>
                    <dt>Marca</dt>
                    <dd>{product.brand || "Pendiente"}</dd>
                  </div>
                  <div>
                    <dt>Categoría</dt>
                    <dd>{product.category || "Pendiente"}</dd>
                  </div>
                  <div>
                    <dt>Tipo</dt>
                    <dd>{product.product_type || "Pendiente"}</dd>
                  </div>
                  <div>
                    <dt>Colecciones</dt>
                    <dd>{product.collections?.join(", ") || "Pendiente"}</dd>
                  </div>
                </dl>
              </div>
              <section className="drawer-section">
                <h3>Variantes</h3>
                {product.variants?.map((item) => (
                  <div className="drawer-row" key={item.id}>
                    <strong>{item.sku || "Sin SKU"}</strong>
                    <span>{item.title || "Variante"}</span>
                    <StatusBadge value={item.reconciliation_status} />
                  </div>
                ))}
              </section>
            </>
          )}
          {tab === "Costos" && (
            <>
              <section className="metric-detail-grid">
                <article>
                  <span>Costo bruto canónico</span>
                  <strong>{money(variant.canonical_cost?.raw_cost)}</strong>
                  <small>
                    {variant.canonical_cost?.tax_treatment === "INCLUDED"
                      ? `IVA incluido ${variant.canonical_cost?.tax_rate}% · no se suma nuevamente`
                      : variant.canonical_cost?.source || "Fuente pendiente"}
                  </small>
                </article>
                <article>
                  <span>Neto derivado auditable</span>
                  <strong>
                    {money(variant.canonical_cost?.derived_net_cost)}
                  </strong>
                  <small>Bruto ÷ (1 + tasa IVA); no reemplaza el bruto</small>
                </article>
                <article>
                  <span>Precio Shopify</span>
                  <strong>{money(variant.price)}</strong>
                  <small>Compare-at: {money(variant.compare_at_price)}</small>
                </article>
                <article>
                  <span>Precio de venta Siigo</span>
                  <strong>
                    {money(variant.siigo_snapshots?.[0]?.sale_price)}
                  </strong>
                  <small>No se interpreta como costo</small>
                </article>
                <article>
                  <span>Costo Siigo</span>
                  <strong>No provisto</strong>
                  <small>
                    {variant.siigo_snapshots?.[0]?.cost_status ||
                      "SKU no observado en Siigo"}
                  </small>
                </article>
              </section>
              <section className="drawer-section">
                <h3>Fuentes conservadas sin sobrescritura</h3>
                {variant.cost_observations?.length ? (
                  variant.cost_observations.map((item) => (
                    <div className="source-row" key={item.id}>
                      <div>
                        <strong>{item.source_label}</strong>
                        <small>
                          {item.evidence_reference || "Evidencia pendiente"}
                        </small>
                        {item.derived_net_cost != null && (
                          <small>
                            Neto derivado: {money(item.derived_net_cost)} ·
                            bruto intacto
                          </small>
                        )}
                      </div>
                      <span>{money(item.raw_cost)}</span>
                      <StatusBadge
                        value={
                          item.tax_treatment === "INCLUDED"
                            ? "IVA INCLUIDO"
                            : item.tax_treatment || "IVA PENDIENTE"
                        }
                        tone={
                          item.tax_treatment === "PENDING"
                            ? "warning"
                            : "success"
                        }
                      />
                    </div>
                  ))
                ) : (
                  <div className="warning-box">
                    No hay costos observados. El SKU puede operar catálogo-only
                    cuando exista una fuente aprobada.
                  </div>
                )}
              </section>
              {variant.canonical_cost && (
                <div className="rule-explanation">
                  <strong>Por qué se eligió</strong>
                  <p>{variant.canonical_cost.reason}</p>
                  <small>Política: {variant.canonical_cost.policy_name}</small>
                </div>
              )}
            </>
          )}
          {tab === "Inventario y envíos" && (
            <>
              <section className="drawer-section">
                <h3>Inventario por fuente y bodega</h3>
                {variant.inventory_sources?.length ? (
                  variant.inventory_sources.map((item) => (
                    <div className="source-row" key={item.id}>
                      <div>
                        <strong>{item.source_name}</strong>
                        <small>
                          {item.warehouse_name || "Bodega pendiente"} ·{" "}
                          {item.method_label}
                        </small>
                      </div>
                      <span>
                        {item.stock_unknown
                          ? "Inventario pendiente"
                          : `${item.available_to_promise} disponible`}
                      </span>
                      <StatusBadge
                        value={item.canonical ? "CANÓNICO" : "FUENTE"}
                        tone={item.stock_unknown ? "warning" : "success"}
                      />
                    </div>
                  ))
                ) : (
                  <div className="warning-box">
                    Inventario desconocido: la publicación futura debe quedar
                    bloqueada, no convertirse en cero.
                  </div>
                )}
              </section>
              <section className="drawer-section">
                <h3>Inteligencia de costo de envío</h3>
                <p>
                  La ficha separa cotización transportadora, costo del vendedor,
                  cobro al comprador y costo final realizado. Nunca usa un error
                  como envío gratis.
                </p>
                <div className="metric-detail-grid">
                  <article>
                    <span>Referencia operativa</span>
                    <strong>
                      {money(variant.shipping_intelligence?.reference?.amount)}
                    </strong>
                    <small>
                      {variant.shipping_intelligence?.reference?.label ||
                        "Pendiente"}
                    </small>
                  </article>
                  <article>
                    <span>Envía actual</span>
                    <strong>
                      {variant.shipping_intelligence?.carrier_quote
                        ?.options_count > 1
                        ? `${money(variant.shipping_intelligence.carrier_quote.min_amount)} – ${money(variant.shipping_intelligence.carrier_quote.max_amount)}`
                        : money(
                            variant.shipping_intelligence?.carrier_quote
                              ?.amount,
                          )}
                    </strong>
                    <small>
                      {variant.shipping_intelligence?.carrier_quote
                        ?.selection_required
                        ? `${variant.shipping_intelligence.carrier_quote.options_count} opciones; elegir por SLA y transportadora`
                        : variant.shipping_intelligence?.carrier_quote
                            ?.carrier || "Faltan paquete o ruta"}
                    </small>
                  </article>
                  <article>
                    <span>Mercado Libre · vendedor</span>
                    <strong>
                      {money(
                        variant.shipping_intelligence?.channels?.MERCADO_LIBRE
                          ?.seller_estimate,
                      )}
                    </strong>
                    <small>Estimación de la publicación actual</small>
                  </article>
                  <article>
                    <span>Mercado Libre · comprador</span>
                    <strong>
                      {money(
                        variant.shipping_intelligence?.channels?.MERCADO_LIBRE
                          ?.buyer_charge,
                      )}
                    </strong>
                    <small>
                      Referencia Bogotá D.C. / Chapinero; no es promedio
                      nacional
                    </small>
                  </article>
                </div>
                <div className="warning-box">
                  P75 por bodega, zona destino, paquete y servicio se habilitará
                  solo cuando exista historial realizado vinculado por SKU. El
                  costo real de guía se concilia después de la venta.
                </div>
              </section>
            </>
          )}
          {tab === "Canales" && (
            <section className="drawer-section">
              <h3>Estado lado a lado</h3>
              {channels.map(([code, label]) => {
                const item = product.channel_snapshots?.find(
                  (snapshot) => snapshot.channel === code,
                );
                return (
                  <div className="channel-detail-row" key={code}>
                    <div>
                      <strong>{label}</strong>
                      <small>
                        {item?.observed_at
                          ? `Última lectura ${new Date(item.observed_at).toLocaleString("es-CO")}`
                          : "Sin lectura"}
                      </small>
                    </div>
                    <StatusBadge value={item?.state || "NO EXISTE"} />
                    <span>ID {item ? "registrado" : "pendiente"}</span>
                    <span>{money(item?.price)}</span>
                    <span>
                      {item?.inventory_available == null
                        ? "Inv. pendiente"
                        : `Inv. ${item.inventory_available}`}
                    </span>
                    <span>Calidad {item?.quality_score ?? "—"}</span>
                  </div>
                );
              })}
              <p className="muted">
                Crear o sincronizar seguirá siendo solo una propuesta hasta
                recibir autorización separada de escritura.
              </p>
            </section>
          )}
          {tab === "Sodimac" && (
            <section className="drawer-section sodimac-drawer">
              <h3>Evidencia Sodimac / Homecenter</h3>
              <p>
                El vínculo se decide por SKU y archivo. Los parecidos de texto o
                imagen solo explican diferencias; nunca crean una coincidencia.
              </p>
              {sodimacLinks.map((link) => {
                const observation = link.latest_observation;
                const comparisons = observation?.field_comparison || {};
                return (
                  <article key={link.id}>
                    <header>
                      <div>
                        <strong>
                          {link.canonical_sku} ↔ {link.sodimac_sku}
                        </strong>
                        <small>
                          {link.listing_id || "ID publicación pendiente"} ·{" "}
                          {link.source_kind}
                        </small>
                      </div>
                      <StatusBadge
                        value={link.status}
                        tone={
                          link.status === "LINKED_EXACT" ? "success" : "warning"
                        }
                      />
                    </header>
                    <div className="sodimac-evidence-summary">
                      <span>
                        <b>{observation?.overall_score ?? "—"}/100</b> calidad
                      </span>
                      <span>
                        <b>{observation?.publication_state || "UNKNOWN"}</b>{" "}
                        publicación
                      </span>
                      <span>
                        <b>{observation?.inventory_available ?? "UNKNOWN"}</b>{" "}
                        inventario
                      </span>
                      <span>
                        <b>{observation?.evidence_class || "UNKNOWN"}</b>{" "}
                        evidencia
                      </span>
                    </div>
                    <div className="sodimac-diff-grid">
                      {Object.entries(comparisons)
                        .filter(
                          ([field]) =>
                            field !== "decision_rule" && field !== "blockers",
                        )
                        .map(([field, value]) => (
                          <div key={field}>
                            <strong>{field.replaceAll("_", " ")}</strong>
                            <small>{evidenceValue(value)}</small>
                          </div>
                        ))}
                    </div>
                    <div className="warning-box">
                      <strong>Criterio</strong>
                      <span>
                        {comparisons.decision_rule || "Sin evaluación todavía."}
                      </span>
                      {comparisons.blockers?.length ? (
                        <small>
                          Bloqueos: {comparisons.blockers.join(" · ")}
                        </small>
                      ) : (
                        <small>Sin bloqueos de identidad registrados.</small>
                      )}
                    </div>
                    {link.listing_url && (
                      <a
                        href={link.listing_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Abrir evidencia registrada
                      </a>
                    )}
                  </article>
                );
              })}
              {!sodimacLinks.length && (
                <div className="warning-box">
                  UNLINKED: falta archivo de identidad Sodimac. No se buscará ni
                  enlazará por parecido.
                </div>
              )}
            </section>
          )}
          {tab === "Calidad" && (
            <section className="drawer-section">
              <h3>Calidad de publicación · {product.quality_score}/100</h3>
              <div className="quality-meter">
                <span style={{ width: `${product.quality_score}%` }} />
              </div>
              <h4>Datos faltantes</h4>
              {product.missing_fields?.length ? (
                <ul>
                  {product.missing_fields.map((field) => (
                    <li key={field}>{field}</li>
                  ))}
                </ul>
              ) : (
                <p>Sin faltantes en este fixture.</p>
              )}
            </section>
          )}
          {tab === "Historial" && (
            <section className="drawer-section">
              <h3>Historial reversible</h3>
              {history.length ? (
                history.map((event) => (
                  <div className="history-event" key={event.id}>
                    <strong>{event.action}</strong>
                    <span>
                      {new Date(event.created_at).toLocaleString("es-CO")}
                    </span>
                    <small>
                      {event.reversible ? "Reversible" : "No reversible"}
                    </small>
                  </div>
                ))
              ) : (
                <p>Sin eventos para este producto.</p>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}
