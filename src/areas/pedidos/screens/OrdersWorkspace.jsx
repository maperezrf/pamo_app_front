import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { authenticatedDocumentUrl, ordersApi } from "../api";
import { communicationsApi } from "../../communications/api";


const stateLabels = {
  without_guide: "Sin guía",
  guide_without_tracking: "Guía sin trazabilidad",
  picked_up: "Recogido",
  in_transit: "En tránsito",
  out_for_delivery: "En reparto",
  delivered: "Entregado",
  exception: "Con novedad",
  returned: "Devuelto",
  logistically_cancelled: "Cancelado",
};

const supplierStateLabels = {
  pending_response: "Pendiente de respuesta",
  received: "Confirmado",
  ready_for_guide: "Listo para despacho",
  issue_reported: "Novedad reportada",
};

const guideDeliveryLabels = {
  not_requested: "Guía no solicitada",
  requested: "Guía solicitada · pendiente",
  ready_to_send: "Guía lista para enviar",
  sent: "Guía enviada",
  failed: "Fallo al enviar guía",
};

const channelLabels = {
  pamo_canonical: "Fuente canónica PAMO",
  shopify: "Shopify",
  mercado_libre: "Mercado Libre",
  "mercado-libre": "Mercado Libre",
  falabella: "Falabella",
  sodimac: "Sodimac",
};

const orderChannelLabel = (order) => {
  const origin = order?.business_origin || order?.channel;
  const via = order?.business_origin_via || order?.channel;
  if (origin === "sodimac" && via === "shopify") return "Sodimac vía Shopify";
  return channelLabels[origin] || origin;
};

const integrationStateLabels = {
  connected: "Conectada",
  connected_unverified: "Conectada · pendiente de verificación",
  connected_canonical_read_model: "Conectada al modelo canónico",
  connected_read_only: "Conectada · solo lectura",
  permission_missing: "Faltan permisos",
  credential_missing: "Faltan credenciales",
  read_model_missing: "Modelo canónico no disponible",
  canonical_labels_read_only: "Etiquetas consultadas · solo lectura",
};

const labelStatusLabels = {
  available: "PDF listo",
  pending_provider: "PDF pendiente",
  not_printable: "Full · sin PDF del vendedor",
  temporary_error: "Reintento automático",
};

const labelStatusDetails = {
  available: "El archivo está disponible para consultar y compartir.",
  pending_provider: "La plataforma todavía no habilita el PDF; se volverá a consultar automáticamente.",
  not_printable: "Mercado Libre Full prepara el envío desde sus depósitos y no entrega una etiqueta de venta al vendedor.",
  temporary_error: "La consulta no terminó correctamente. Los datos actuales se conservaron y habrá un nuevo intento automático.",
};

const formatStatusDate = (value) =>
  value ? new Date(value).toLocaleString("es-CO") : "Sin lectura registrada";

const defaultTemplate =
  "Hola, {{contacto}}.\n\nTienes un nuevo despacho de {{bodega}}:\n\n{{lista_pedidos}}\n\nAgradecemos confirmar su estado.";
const AUTO_REFRESH_MS = 5 * 60 * 1000;
const noveltyOptions = [
  ["supplier_stockout", "Producto agotado"],
  ["supplier_partial", "Cantidad incompleta"],
  ["supplier_damage", "Producto averiado"],
  ["supplier_guide_issue", "Problema con la guía"],
  ["supplier_delay", "Retraso / no despacha hoy"],
  ["supplier_other", "Otra novedad"],
];
const skippedReasonLabels = {
  warehouse_not_assigned: "sin bodega asignada",
  warehouse_messaging_disabled: "mensajería desactivada",
  active_contact_missing: "sin contacto activo",
};

const emptyConfig = {
  warehouse_id: "",
  template_body: defaultTemplate,
  followup_template_body: "",
  maximum_attempts: 2,
  active: true,
  contacts: [],
};

const arrayValue = (value) => (Array.isArray(value) ? value : value ? [value] : []);
const formatMoney = (value, currency = "COP") =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function StackedValue({ values, fallback = "—" }) {
  const normalized = arrayValue(values);
  return (
    <span className="stacked-value">
      {(normalized.length ? normalized : [fallback]).map((value, index) => (
        <span key={`${value}-${index}`}>{value || fallback}</span>
      ))}
    </span>
  );
}

function GuideStack({ trackingNumbers, statuses }) {
  const guides = arrayValue(trackingNumbers);
  const labelStatuses = arrayValue(statuses);
  const length = Math.max(guides.length, labelStatuses.length, 1);
  return (
    <span className="guide-stack">
      {Array.from({ length }, (_, index) => {
        const guide = guides[index] || "Sin guía";
        const status = labelStatuses[index] || "pending_provider";
        return (
          <span key={`${guide}-${status}-${index}`}>
            <b>{guide}</b>
            <em className={`label-status label-${status}`}>
              {labelStatusLabels[status] || "PDF pendiente"}
            </em>
          </span>
        );
      })}
    </span>
  );
}

function statusClass(state) {
  return `status-pill state-${state || "without_guide"}`;
}

function cacheKey(user) {
  return `pamo-orders-cache-v1:${user?.email || "anonymous"}`;
}

function readCache(user) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(user)) || "null");
    if (!cached || Date.now() - cached.savedAt > 15 * 60 * 1000) return null;
    return cached.payload;
  } catch {
    return null;
  }
}

function writeCache(user, payload) {
  localStorage.setItem(cacheKey(user), JSON.stringify({ savedAt: Date.now(), payload }));
}

export default function OrdersWorkspace({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [guide, setGuide] = useState(searchParams.get("guide") || "");
  const [channel, setChannel] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState([]);
  const [detail, setDetail] = useState(null);
  const [locations, setLocations] = useState([]);
  const [options, setOptions] = useState({ channels: [], warehouses: [], carriers: [] });
  const [integrations, setIntegrations] = useState([]);
  const [messagingCapabilities, setMessagingCapabilities] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [configOpen, setConfigOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState(emptyConfig);
  const [followups, setFollowups] = useState([]);
  const [messagingSkipped, setMessagingSkipped] = useState([]);
  const [noveltyDrafts, setNoveltyDrafts] = useState({});
  const [savedFilters, setSavedFilters] = useState([]);
  const [savedFilterName, setSavedFilterName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);

  const query = useMemo(
    () => ({ search, guide, channel, from, to, page, page_size: 25 }),
    [search, guide, channel, from, to, page],
  );

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const payload = await ordersApi.list(query);
      setOrders(payload.orders || []);
      setTotal(payload.total || 0);
      writeCache(user, payload);
      setStale(false);
    } catch (reason) {
      const cached = readCache(user);
      if (cached) {
        setOrders(cached.orders || []);
        setTotal(cached.total || 0);
      }
      setStale(true);
      setError(reason.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [query, user]);

  const loadSupportData = useCallback(async () => {
    const results = await Promise.allSettled([
      ordersApi.locations(),
      ordersApi.filterOptions(),
      ordersApi.integrations(),
      ordersApi.messagingConfigs(),
      ordersApi.savedFilters(),
      communicationsApi.capabilities(),
    ]);
    if (results[0].status === "fulfilled") setLocations(results[0].value.locations || []);
    if (results[1].status === "fulfilled") setOptions(results[1].value);
    if (results[2].status === "fulfilled") setIntegrations(results[2].value.providers || []);
    if (results[3].status === "fulfilled") setConfigs(results[3].value.configs || []);
    if (results[4].status === "fulfilled") setSavedFilters(results[4].value.filters || []);
    if (results[5].status === "fulfilled") setMessagingCapabilities(results[5].value);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(loadOrders, 220);
    return () => window.clearTimeout(timer);
  }, [loadOrders]);

  useEffect(() => {
    loadSupportData();
  }, [loadSupportData]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible" || saving) return;
      void loadOrders(true);
      void loadSupportData();
    };
    const timer = window.setInterval(refresh, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [loadOrders, loadSupportData, saving]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    if (guide) next.set("guide", guide);
    setSearchParams(next, { replace: true });
  }, [guide, search, setSearchParams]);

  const openOrder = async (orderId) => {
    setSaving("detail");
    setError("");
    try {
      setDetail(await ordersApi.detail(orderId));
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving("");
    }
  };

  const updateDetailShipment = (shipmentId, updater) => {
    setDetail((current) => ({
      ...current,
      shipments: current.shipments.map((shipment) =>
        shipment.id === shipmentId ? updater(shipment) : shipment,
      ),
    }));
  };

  const saveShipment = async (shipment) => {
    setSaving(`shipment-${shipment.id}`);
    setError("");
    try {
      const payload = await ordersApi.updateShipment(shipment.id, {
        version: shipment.version,
        warehouse_location_id: shipment.warehouse_location_id,
        carrier: shipment.carrier || "",
        tracking_number: shipment.tracking_number || "",
        tracking_url: shipment.tracking_url || "",
        logistics_state: shipment.logistics_state,
        customer_context: shipment.customer_context || "",
      });
      updateDetailShipment(shipment.id, () => payload.shipment);
      setNotice("Despacho guardado y auditado localmente.");
      await loadOrders();
    } catch (reason) {
      setError(reason.message);
      if (reason.status === 409 && detail) await openOrder(detail.id);
    } finally {
      setSaving("");
    }
  };

  const uploadGuide = async (shipment, file) => {
    if (!file) return;
    setSaving(`document-${shipment.id}`);
    setError("");
    try {
      await ordersApi.uploadDocument(shipment.id, file);
      await openOrder(detail.id);
      await loadOrders();
      setNotice("Guía privada cargada correctamente.");
    } catch (reason) {
      setError(reason.data?.file?.[0] || reason.message);
    } finally {
      setSaving("");
    }
  };

  const simulateSupplierResponse = async (shipment, action, category = "", responseDetail = "") => {
    setSaving(`supplier-${shipment.id}`);
    setError("");
    try {
      await ordersApi.simulateSupplierResponse(shipment.id, action, category, responseDetail);
      await openOrder(detail.id);
      await loadOrders();
      setNotice(
        action === "report_issue"
          ? "Novedad abierta. En el flujo real, el proveedor recibe de inmediato el menú para clasificarla."
          : action === "provide_issue_detail"
            ? "Detalle de la novedad asociado al despacho correcto. No se envió ningún WhatsApp."
            : "Respuesta de proveedor simulada localmente. No se envió ningún WhatsApp.",
      );
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving("");
    }
  };

  const prepareMessages = async () => {
    if (!selected.length) return;
    setSaving("whatsapp");
    setError("");
    try {
      const payload = await ordersApi.prepareWhatsApp(selected);
      setFollowups(payload.generated || []);
      setMessagingSkipped(payload.skipped || []);
      setNotice(
        `${payload.recipientCount} mensaje(s) para ${payload.shipmentCount} despacho(s). ` +
        `${payload.skipped?.length || 0} despacho(s) omitido(s). Nada se envió automáticamente.`,
      );
    } catch (reason) {
      setFollowups([]);
      setMessagingSkipped(reason.data?.skipped || []);
      setError(reason.message);
    } finally {
      setSaving("");
    }
  };

  const openFollowup = async (followup) => {
    const payload = await ordersApi.markFollowup(followup.id, "open");
    window.open(payload.whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const chooseConfig = (warehouseId) => {
    const found = configs.find((config) => String(config.warehouse_id) === String(warehouseId));
    setConfigDraft(
      found
        ? { ...found, contacts: found.contacts.map((item) => ({ ...item })) }
        : { ...emptyConfig, warehouse_id: warehouseId, contacts: [] },
    );
  };

  const saveConfig = async () => {
    setSaving("config");
    setError("");
    try {
      await ordersApi.saveMessagingConfig(configDraft);
      await loadSupportData();
      setNotice("Configuración de mensajería guardada localmente.");
    } catch (reason) {
      setError(reason.data?.contacts?.[0] || reason.message);
    } finally {
      setSaving("");
    }
  };

  const saveCurrentFilter = async () => {
    if (!savedFilterName.trim()) return;
    await ordersApi.saveFilter(savedFilterName.trim(), { search, guide, channel, from, to });
    setSavedFilterName("");
    await loadSupportData();
  };

  const applySavedFilter = (id) => {
    const found = savedFilters.find((item) => String(item.id) === String(id));
    if (!found) return;
    setSearch(found.filters.search || "");
    setGuide(found.filters.guide || "");
    setChannel(found.filters.channel || "");
    setFrom(found.filters.from || "");
    setTo(found.filters.to || "");
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setGuide("");
    setChannel("");
    setFrom("");
    setTo("");
    setPage(1);
  };

  const allVisibleShipmentIds = orders.flatMap((order) => order.shipment_ids || []);
  const visibleSelected = allVisibleShipmentIds.length > 0 &&
    allVisibleShipmentIds.every((id) => selected.includes(id));

  return (
    <section className="orders-page">
      <header className="orders-page-heading">
        <div>
          <p className="eyebrow">VENTAS</p>
          <h1>Pedidos</h1>
          <p>Actualización local automática cada 5 minutos, sin escrituras externas.</p>
        </div>
        <span className="local-safety-pill">externalWrites: 0</span>
      </header>

      {stale && (
        <div className="orders-alert warning">
          Vista de contingencia: se muestran los últimos datos locales por un máximo de 15 minutos.
          <button type="button" onClick={() => loadOrders()}>Reintentar ahora</button>
        </div>
      )}
      {error && <div className="orders-alert error">{error}</div>}
      {notice && <div className="orders-alert success">{notice}</div>}

      <section className="messaging-config-card">
        <div
          className={`pilot-messaging-status ${messagingCapabilities?.externalWritesEnabled ? "pilot-live" : "pilot-simulation"}`}
          role="status"
        >
          <div>
            <strong>Piloto interno de WhatsApp</strong>
            <span>
              Destino único {messagingCapabilities?.pilotRecipientMasked || "sin configurar"} ·
              {messagingCapabilities?.internalOrderNotificationsEnabled
                ? messagingCapabilities?.externalWritesEnabled
                  ? ` salida real controlada en ${messagingCapabilities?.deploymentTier || "staging"}`
                  : " preparado, pero Meta permanece bloqueado"
                : " automatización apagada; no procesa pedidos"}
            </span>
          </div>
          <b>{messagingCapabilities?.internalOrderNotificationsEnabled ? "Piloto habilitado" : "Apagado"}</b>
        </div>
        <button
          type="button"
          className="messaging-config-toggle"
          onClick={() => setConfigOpen((value) => !value)}
        >
          <span>
            <strong>Configuración de mensajería por bodega</strong>
            <small>Una libreta por bodega. Cada despacho se prepara por separado para cada contacto activo.</small>
          </span>
          <b>{configOpen ? "−" : "+"}</b>
        </button>
        {configOpen && (
          <div className="messaging-config-body">
            <div className="warehouse-message-summary">
              {locations.map((location) => {
                const config = configs.find(
                  (item) => String(item.warehouse_id) === String(location.id),
                );
                const activeContacts = config?.contacts?.filter((item) => item.active).length || 0;
                return (
                  <button
                    type="button"
                    key={location.id}
                    className={config?.active && activeContacts ? "warehouse-enabled" : "warehouse-disabled"}
                    onClick={() => chooseConfig(String(location.id))}
                  >
                    <strong>{location.name}</strong>
                    <span>
                      {config?.active
                        ? `${activeContacts} contacto(s) activo(s)`
                        : "No envía mensajes"}
                    </span>
                  </button>
                );
              })}
            </div>
            <label>
              Bodega
              <select
                value={configDraft.warehouse_id}
                onChange={(event) => chooseConfig(event.target.value)}
              >
                <option value="">Selecciona una bodega</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
            <label className="warehouse-messaging-toggle">
              <input
                type="checkbox"
                checked={configDraft.active}
                onChange={(event) =>
                  setConfigDraft((current) => ({ ...current, active: event.target.checked }))
                }
              />
              <span>
                <strong>Enviar pedidos de esta bodega por WhatsApp</strong>
                <small>Si está apagado, sus despachos se omiten y nunca usan contactos de otra bodega.</small>
              </span>
            </label>
            <div className="contact-editor-list">
              {configDraft.contacts.map((contact, index) => (
                <div className="contact-editor" key={contact.id || index}>
                  <input
                    aria-label={`Nombre contacto ${index + 1}`}
                    value={contact.name}
                    placeholder="Nombre"
                    onChange={(event) =>
                      setConfigDraft((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, name: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <input
                    aria-label={`Teléfono contacto ${index + 1}`}
                    value={contact.phone}
                    placeholder="57300…"
                    onChange={(event) =>
                      setConfigDraft((current) => ({
                        ...current,
                        contacts: current.contacts.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, phone: event.target.value } : item,
                        ),
                      }))
                    }
                  />
                  <label className="inline-check">
                    <input
                      type="checkbox"
                      checked={contact.active}
                      onChange={(event) =>
                        setConfigDraft((current) => ({
                          ...current,
                          contacts: current.contacts.map((item, itemIndex) =>
                            itemIndex === index ? { ...item, active: event.target.checked } : item,
                          ),
                        }))
                      }
                    />
                    Activo
                  </label>
                  <button
                    type="button"
                    className="icon-action"
                    aria-label={`Eliminar contacto ${index + 1}`}
                    onClick={() =>
                      setConfigDraft((current) => ({
                        ...current,
                        contacts: current.contacts.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="secondary-action"
                onClick={() =>
                  setConfigDraft((current) => ({
                    ...current,
                    contacts: [...current.contacts, { name: "", phone: "", active: true }],
                  }))
                }
              >
                + Agregar contacto
              </button>
            </div>
            <label>
              Plantilla inicial
              <textarea
                value={configDraft.template_body}
                onChange={(event) =>
                  setConfigDraft((current) => ({ ...current, template_body: event.target.value }))
                }
              />
            </label>
            <label>
              Plantilla de seguimiento
              <textarea
                value={configDraft.followup_template_body}
                placeholder="Mensaje de recordatorio opcional"
                onChange={(event) =>
                  setConfigDraft((current) => ({
                    ...current,
                    followup_template_body: event.target.value,
                  }))
                }
              />
            </label>
            <div className="config-footer">
              <span>Regla: 1 despacho × cada contacto activo. Máximo 2 intentos.</span>
              <button
                type="button"
                className="primary-action"
                disabled={!configDraft.warehouse_id || saving === "config"}
                onClick={saveConfig}
              >
                {saving === "config" ? "Guardando…" : "Guardar configuración"}
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="orders-panel">
        <div className="orders-filter-grid">
          <input
            className="orders-search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Buscar pedido, cliente, correo, SKU o guía"
            aria-label="Buscar pedidos"
          />
          <label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Hasta<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <select value={channel} onChange={(event) => { setChannel(event.target.value); setPage(1); }}>
            <option value="">Todos los canales</option>
            {options.channels?.map((item) => (
              <option key={item} value={item}>{channelLabels[item] || item}</option>
            ))}
          </select>
          <button type="button" className="secondary-action" onClick={clearFilters}>Limpiar</button>
        </div>

        <div className="quick-filter-row" aria-label="Filtros rápidos de guía">
          {[
            ["", "Todos"],
            ["missing", "Sin guía"],
            ["present_without_tracking", "Con guía · sin trazabilidad"],
            ["missing_or_without_tracking", "Revisión combinada"],
          ].map(([value, label]) => (
            <button
              type="button"
              key={label}
              className={guide === value ? "active" : ""}
              onClick={() => { setGuide(value); setPage(1); }}
            >
              {label}
            </button>
          ))}
        </div>

        <details className="integration-status">
          <summary>Fuentes de pedidos e integraciones locales</summary>
          <div>
            {integrations.map((item) => (
              <article key={item.provider}>
                <strong>{channelLabels[item.provider] || item.provider}</strong>
                <span>{item.state === "disabled_local" ? "Aislada en local" : integrationStateLabels[item.state] || item.state}</span>
                <small>{item.records_observed} registro(s) observado(s)</small>
                {item.provider === "sodimac" && item.details?.viaShopify > 0 && (
                  <>
                    <small>
                      Operación vigente vía Shopify: {item.details.viaShopify} · último pedido: {formatStatusDate(item.details.latestBusinessOrderAt)}
                    </small>
                    {item.details?.sourceChannelOrders > 0 && (
                      <small>
                        Las fuentes pueden superponerse; no se ocultan históricos sin un número OC exacto.
                      </small>
                    )}
                  </>
                )}
                {item.details?.latestSyncAt && (
                  <small>
                    {item.provider === "sodimac" ? "Fuente directa histórica" : "Origen actualizado"}: {formatStatusDate(item.details.latestSyncAt)}
                  </small>
                )}
                {item.details?.lastCheckAt && <small>Última comprobación: {formatStatusDate(item.details.lastCheckAt)}</small>}
                {item.provider === "envia" && item.details?.cachedTotal != null && (
                  <>
                    <small>
                      PDF locales: {item.details.cachedTotal} · pendientes del proveedor: {item.details.pendingProvider || 0}
                    </small>
                    <small>
                      Full sin PDF imprimible: {item.details.notPrintable || 0} · reintentos técnicos: {item.details.temporaryError || 0}
                    </small>
                  </>
                )}
                {item.last_error_code && <small>Requiere revisión: {item.last_error_code}</small>}
              </article>
            ))}
          </div>
        </details>

        <div className="bulk-actionbar">
          <div>
            <strong>{selected.length} despacho(s) seleccionado(s)</strong>
            <small>La guía no es requisito para preparar el mensaje.</small>
          </div>
          <button
            type="button"
            className="primary-action"
            disabled={!selected.length || stale || saving === "whatsapp"}
            onClick={prepareMessages}
          >
            {saving === "whatsapp" ? "Preparando…" : "Preparar WhatsApp Web (manual)"}
          </button>
          <div className="saved-filter-tools">
            <select defaultValue="" onChange={(event) => applySavedFilter(event.target.value)}>
              <option value="">Vistas guardadas</option>
              {savedFilters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input
              value={savedFilterName}
              onChange={(event) => setSavedFilterName(event.target.value)}
              placeholder="Nombre de vista"
            />
            <button type="button" className="secondary-action" onClick={saveCurrentFilter}>Guardar vista</button>
          </div>
        </div>

        {followups.length > 0 && (
          <div className="prepared-messages">
            <strong>Mensajes preparados</strong>
            {followups.map((followup) => (
              <article key={followup.id}>
                <div>
                  <b>{followup.contactName}</b>
                  <span>{followup.warehouse} · {followup.orderNumbers.join(", ")}</span>
                </div>
                <button type="button" className="primary-action" onClick={() => openFollowup(followup)}>
                  Revisar y abrir WhatsApp
                </button>
              </article>
            ))}
          </div>
        )}

        {messagingSkipped.length > 0 && (
          <div className="skipped-messages" role="status">
            <strong>Despachos omitidos</strong>
            {messagingSkipped.map((item) => (
              <span key={`${item.shipmentId}-${item.reason}`}>
                {item.warehouse}: {skippedReasonLabels[item.reason] || item.reason}
              </span>
            ))}
          </div>
        )}

        <div className="orders-table-wrap">
          <table className="orders-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={visibleSelected}
                    onChange={() =>
                      setSelected((current) =>
                        visibleSelected
                          ? current.filter((id) => !allVisibleShipmentIds.includes(id))
                          : [...new Set([...current, ...allVisibleShipmentIds])],
                      )
                    }
                    aria-label="Seleccionar despachos visibles"
                  />
                </th>
                <th>ID canal</th>
                <th>Canal</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Bodega</th>
                <th>Origen</th>
                <th>Total</th>
                <th>Costo envío</th>
                <th>Transportadora</th>
                <th>Guía</th>
                <th>Proveedor</th>
                <th>Trazabilidad</th>
              </tr>
            </thead>
            <tbody>
              {loading && !orders.length && (
                <tr><td colSpan="13" className="empty-table">Cargando pedidos…</td></tr>
              )}
              {!loading && !orders.length && (
                <tr><td colSpan="13" className="empty-table">Sin pedidos para esta vista.</td></tr>
              )}
              {orders.map((order) => (
                <tr
                  key={order.id}
                  tabIndex="0"
                  onClick={(event) => {
                    if (!event.target.closest("a,button,input,label,select")) openOrder(order.id);
                  }}
                  onKeyDown={(event) => event.key === "Enter" && openOrder(order.id)}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={(order.shipment_ids || []).every((id) => selected.includes(id))}
                      onChange={() => {
                        const ids = order.shipment_ids || [];
                        const all = ids.every((id) => selected.includes(id));
                        setSelected((current) =>
                          all
                            ? current.filter((id) => !ids.includes(id))
                            : [...new Set([...current, ...ids])],
                        );
                      }}
                      aria-label={`Seleccionar pedido ${order.channel_order_id}`}
                    />
                  </td>
                  <td>
                    {order.channel_order_url ? (
                      <a
                        className="order-source-link"
                        href={order.channel_order_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {order.channel_order_id}
                      </a>
                    ) : (
                      <strong>{order.channel_order_id}</strong>
                    )}
                    {order.shipment_count > 1 && <small>{order.shipment_count} ubicaciones</small>}
                  </td>
                  <td>{orderChannelLabel(order)}</td>
                  <td>{new Date(order.placed_at).toLocaleString("es-CO")}</td>
                  <td><strong>{order.customer_name}</strong><small>{order.customer_email || "Sin correo"}</small></td>
                  <td><StackedValue values={order.warehouses} fallback="Sin asignar" /></td>
                  <td><StackedValue values={order.warehouses} fallback="No informado" /></td>
                  <td><strong>{formatMoney(order.grand_total, order.currency)}</strong></td>
                  <td>{order.carrier_cost ? formatMoney(order.carrier_cost, order.currency) : "—"}</td>
                  <td><StackedValue values={order.carriers} /></td>
                  <td>
                    <GuideStack
                      trackingNumbers={order.tracking_numbers}
                      statuses={order.label_statuses}
                    />
                  </td>
                  <td>
                    <StackedValue values={arrayValue(order.supplier_states).map((item) => supplierStateLabels[item] || item)} />
                    {order.open_novelty_count > 0 && <small className="supplier-alert">{order.open_novelty_count} novedad(es) abierta(s)</small>}
                  </td>
                  <td>
                    <span className={statusClass(arrayValue(order.logistics_state)[0])}>
                      {arrayValue(order.logistics_state).map((item) => stateLabels[item] || item).join(" · ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="orders-pagination">
          <span>{total} pedido(s)</span>
          <div>
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>‹</button>
            <span>Página {page} de {Math.max(1, Math.ceil(total / 25))}</span>
            <button
              type="button"
              disabled={page >= Math.ceil(total / 25)}
              onClick={() => setPage((value) => value + 1)}
            >›</button>
          </div>
        </footer>
      </section>

      {detail && (
        <div className="drawer-backdrop" role="presentation" onMouseDown={() => setDetail(null)}>
          <aside
            className="order-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={`Pedido ${detail.channel_order_id}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>{orderChannelLabel(detail)}</span>
                <h2>{detail.channel_order_id}</h2>
              </div>
              <button type="button" className="icon-action" onClick={() => setDetail(null)}>×</button>
            </header>
            <section className="drawer-customer">
              <strong>{detail.customer_name}</strong>
              <span>{detail.customer_email || "Sin correo"}</span>
              <span>{detail.customer_phone || "Sin teléfono"}</span>
            </section>
            <section className="drawer-section">
              <h3>Artículos</h3>
              {detail.items.map((item) => (
                <div className="drawer-line" key={item.id}>
                  <div className="drawer-item-identity">
                    <strong>SKU {item.sku || "Sin SKU"}</strong>
                    <span>{item.name}</span>
                    <small>{item.quantity} unidad(es)</small>
                  </div>
                  <b>{formatMoney(item.line_total, detail.currency)}</b>
                </div>
              ))}
            </section>
            <section className="drawer-section">
              <h3>Despachos</h3>
              {detail.shipments.map((shipment) => (
                <article className="shipment-card" key={shipment.id}>
                  <header>
                    <div>
                      <strong>{shipment.warehouse_name || "Sin asignar"}</strong>
                      <small>{shipment.items.map((item) => `${item.sku} × ${item.quantity}`).join(" · ")}</small>
                    </div>
                    <span className={statusClass(shipment.logistics_state)}>
                      {stateLabels[shipment.logistics_state] || shipment.logistics_state}
                    </span>
                  </header>
                  <div className="supplier-response-summary">
                    <div><span>Proveedor</span><strong>{supplierStateLabels[shipment.supplier_state] || shipment.supplier_state}</strong></div>
                    <div><span>Guía por WhatsApp</span><strong>{guideDeliveryLabels[shipment.guide_delivery_state] || shipment.guide_delivery_state}</strong></div>
                  </div>
                  <div className="supplier-simulator" aria-label="Simular respuesta del proveedor">
                    <span>Prueba local · no envía mensajes</span>
                    <div>
                      <button type="button" disabled={saving === `supplier-${shipment.id}`} onClick={() => simulateSupplierResponse(shipment, "order_received")}>Confirmado</button>
                      <button type="button" disabled={saving === `supplier-${shipment.id}`} onClick={() => simulateSupplierResponse(shipment, "report_stockout")}>Agotado</button>
                      <button type="button" disabled={saving === `supplier-${shipment.id}`} onClick={() => simulateSupplierResponse(shipment, "request_guide")}>Listo para despacho</button>
                      <button type="button" disabled={saving === `supplier-${shipment.id}`} onClick={() => simulateSupplierResponse(shipment, "report_issue")}>Reportar novedad</button>
                    </div>
                  </div>
                  {shipment.novelties?.filter((item) => item.state === "open").map((novelty) => (
                    <div className="supplier-novelty" key={novelty.id}>
                      <strong>Novedad del proveedor</strong><span>{novelty.detail}</span>
                      {novelty.detail_state === "awaiting_category" && (
                        <div className="novelty-category-actions">
                          <small>Así se verá la respuesta inmediata en WhatsApp:</small>
                          {noveltyOptions.map(([category, label]) => (
                            <button
                              type="button"
                              key={category}
                              disabled={saving === `supplier-${shipment.id}`}
                              onClick={() =>
                                simulateSupplierResponse(shipment, "classify_issue", category)
                              }
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                      {novelty.detail_state === "awaiting_detail" && (
                        <div className="novelty-detail-simulator">
                          <small>Simula la respuesta escrita al mensaje anterior:</small>
                          <input
                            value={noveltyDrafts[novelty.id] || ""}
                            placeholder="Ej. SKU 8844 agotado hasta el viernes"
                            onChange={(event) =>
                              setNoveltyDrafts((current) => ({
                                ...current,
                                [novelty.id]: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            disabled={
                              saving === `supplier-${shipment.id}` ||
                              !(noveltyDrafts[novelty.id] || "").trim()
                            }
                            onClick={() =>
                              simulateSupplierResponse(
                                shipment,
                                "provide_issue_detail",
                                "",
                                noveltyDrafts[novelty.id],
                              )
                            }
                          >
                            Guardar respuesta simulada
                          </button>
                        </div>
                      )}
                      {["awaiting_item", "awaiting_quantity"].includes(novelty.detail_state) && (
                        <small className="novelty-step-note">
                          Flujo seguro en WhatsApp: primero se selecciona el SKU y luego la cantidad afectada.
                        </small>
                      )}
                    </div>
                  ))}
                  {!!shipment.supplier_response_events?.length && (
                    <details className="supplier-history" open>
                      <summary>Novedades e historial ({shipment.supplier_response_events.length})</summary>
                      {shipment.supplier_response_events.map((event) => (
                        <div key={event.id}>
                          <strong>{event.action_label || event.action}</strong>
                          <span>{event.warehouse || shipment.warehouse_name || "Sin bodega"} · {event.actor || `Contacto ••••${event.sender_suffix}`}</span>
                          <small>{new Date(event.occurred_at).toLocaleString("es-CO")} · {event.source} · {event.result}</small>
                        </div>
                      ))}
                    </details>
                  )}
                  <div className="shipment-fields">
                    <label>
                      Bodega
                      <select
                        value={shipment.warehouse_location_id || ""}
                        onChange={(event) =>
                          updateDetailShipment(shipment.id, (current) => ({
                            ...current,
                            warehouse_location_id: Number(event.target.value),
                            warehouse_name: locations.find((item) => String(item.id) === event.target.value)?.name || current.warehouse_name,
                          }))
                        }
                      >
                        <option value="">Elegir bodega</option>
                        {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
                      </select>
                    </label>
                    <label>
                      Transportadora
                      <input value={shipment.carrier || ""} onChange={(event) => updateDetailShipment(shipment.id, (current) => ({ ...current, carrier: event.target.value }))} />
                    </label>
                    <label>
                      Guía / referencia
                      <input value={shipment.tracking_number || ""} onChange={(event) => updateDetailShipment(shipment.id, (current) => ({ ...current, tracking_number: event.target.value }))} />
                    </label>
                    <label>
                      URL
                      <input value={shipment.tracking_url || ""} onChange={(event) => updateDetailShipment(shipment.id, (current) => ({ ...current, tracking_url: event.target.value }))} />
                    </label>
                    <label>
                      Estado logístico
                      <select value={shipment.logistics_state} onChange={(event) => updateDetailShipment(shipment.id, (current) => ({ ...current, logistics_state: event.target.value }))}>
                        {Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="primary-action shipment-save"
                      disabled={saving === `shipment-${shipment.id}` || !shipment.warehouse_location_id}
                      onClick={() => saveShipment(shipment)}
                    >
                      {saving === `shipment-${shipment.id}` ? "Guardando…" : "Guardar despacho"}
                    </button>
                  </div>
                  <div className="document-actions">
                    <div className="document-status-copy">
                      <span className={`label-status label-${shipment.label_status || "pending_provider"}`}>
                        {labelStatusLabels[shipment.label_status] || "PDF pendiente"}
                      </span>
                      <small>
                        {labelStatusDetails[shipment.label_status] || labelStatusDetails.pending_provider}
                      </small>
                    </div>
                    {shipment.has_document ? (
                      <a
                        className="guide-link"
                        href={authenticatedDocumentUrl(shipment.document_url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver guía adjunta
                      </a>
                    ) : (
                      <label className="upload-guide">
                        {saving === `document-${shipment.id}`
                          ? "Cargando guía…"
                          : shipment.label_status === "not_printable"
                            ? "Adjuntar documento externo (opcional)"
                            : "Adjuntar guía PDF / JPG / PNG"}
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg,image/png"
                          disabled={saving === `document-${shipment.id}`}
                          onChange={(event) => uploadGuide(shipment, event.target.files?.[0])}
                        />
                      </label>
                    )}
                    <small>Archivo privado, visible sólo con sesión activa.</small>
                  </div>
                  {shipment.tracking_events.length > 0 && (
                    <details className="tracking-events">
                      <summary>Trazabilidad ({shipment.tracking_events.length})</summary>
                      {shipment.tracking_events.map((event) => (
                        <div key={event.id}><strong>{stateLabels[event.state_normalized] || event.state_normalized}</strong><span>{event.description}</span><small>{new Date(event.occurred_at).toLocaleString("es-CO")}</small></div>
                      ))}
                    </details>
                  )}
                </article>
              ))}
            </section>
            <footer className="drawer-footer">
              <span>Todos los cambios quedan versionados y auditados.</span>
              <button type="button" className="primary-action" onClick={() => setDetail(null)}>Volver a pedidos</button>
            </footer>
          </aside>
        </div>
      )}
    </section>
  );
}
